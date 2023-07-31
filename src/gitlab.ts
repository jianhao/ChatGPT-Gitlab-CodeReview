import camelCase from 'camelcase';
import createRequest from './request';
import { logger } from './utils';

import type { GitlabConfig, GitlabDiffRef, GitlabChange } from './types';
import type { AxiosInstance } from 'axios';

// 属性格式化为小驼峰
const formatByCamelCase = (obj: Record<string, any>) => {
  const target = Object.keys(obj).reduce((result, key) => {
    const newkey = camelCase(key);
    return { ...result, [newkey]: obj[key] };
  }, {});

  return target;
};

// 对 diff 内容进行处理
const parseLastDiff = (gitDiff: string) => {
  const diffList = gitDiff.split('\n').reverse();
  const lastLineFirstChar = diffList?.[1]?.[0]; // 最后一行的第一个字符
  const lastDiff = // 增删代码行数信息
    diffList.find((item) => {
      return /^@@ -\d+,\d+ \+\d+,\d+ @@/g.test(item);
    }) || '';

  const [lastOldLineCount, lastNewLineCount] = lastDiff
    .replace(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@.*/g, ($0, $1, $2, $3, $4) => {
      return `${+$1 + +$2},${+$3 + +$4}`;
    })
    .split(',');

  if (!/^\d+$/.test(lastOldLineCount) || !/^\d+$/.test(lastNewLineCount)) {
    return {
      lastOldLine: -1,
      lastNewLine: -1,
    };
  }

  const lastOldLine = lastLineFirstChar === '+' ? -1 : (parseInt(lastOldLineCount) || 0) - 1;
  const lastNewLine = lastLineFirstChar === '-' ? -1 : (parseInt(lastNewLineCount) || 0) - 1;

  return {
    lastOldLine,
    lastNewLine,
  };
};

export default class Gitlab {
  private projectId: string | number;
  private mrIId: number | string;
  private request: AxiosInstance;
  private target: RegExp;

  constructor({ host, token, projectId, mrIId, target }: GitlabConfig) {
    this.request = createRequest(host, { params: { private_token: token } });
    this.mrIId = mrIId;
    this.projectId = projectId;
    this.target = target || /\.(j|t)sx?$/;
  }

 // 获取 mr diff 内容 并转小驼峰
  getChanges() {
    /** https://docs.gitlab.com/ee/api/merge_requests.html#get-single-merge-request-changes */
    return this.request
      .get(`https://gitlab.com/api/v4/projects/${this.projectId}/merge_requests/${this.mrIId}/changes`)
      .then((res) => {
        const { changes, diff_refs: diffRef, state } = res.data;
        const codeChanges: GitlabChange[] = changes
          .map((item: Record<string, any>) => formatByCamelCase(item))
          .filter((item: GitlabChange) => {
            const { newPath, renamedFile, deletedFile } = item;
            if (renamedFile || deletedFile) { // 重命名和删除文件不 review
              return false;
            }
            if (!this.target.test(newPath)) { // 不在正则范围内的不 review (默认所有 js、ts、jsx、tsx 文件)
              return false;
            }
            return true;
          })
          .map((item: GitlabChange) => {
            const { lastOldLine, lastNewLine } = parseLastDiff(item.diff);
            return { ...item, lastNewLine, lastOldLine };
          });

        return {
          state,
          changes: codeChanges,
          ref: formatByCamelCase(diffRef) as GitlabDiffRef,
        };
      })
      .catch((error) => {
        console.log('获取gitlab change 失败', error);

        logger.error(error);
        return {
          state: '',
          changes: [],
          ref: {} as GitlabDiffRef,
        };
      });
  }

  // 添加 review 评论
  async addReviewComment({
    change,
    message,
    ref,
  }: {
    change: GitlabChange;
    message: string;
    ref: GitlabDiffRef;
  }) {
    const { lastNewLine = -1, lastOldLine = -1, newPath, oldPath } = change;

    if (lastNewLine === -1 && lastOldLine === -1) {
      logger.error('Code line error');
      return;
    }

    const newLine =  lastNewLine !== -1 ? lastNewLine : undefined;
    const oldLine =  lastOldLine !== -1 ? lastOldLine : undefined;

     /** https://docs.gitlab.com/ee/api/discussions.html#create-a-new-thread-in-the-merge-request-diff */
    return this.request
      .post(`/api/v4/projects/${this.projectId}/merge_requests/${this.mrIId}/discussions`, {
        body: message,
        position: {
          position_type: 'text',
          base_sha: ref?.baseSha,
          head_sha: ref?.headSha,
          start_sha: ref?.startSha,
          new_path: newPath,
          new_line: newLine,
          old_path: oldPath,
          old_line: oldLine,
        },
      })
      .catch((error) => {
        logger.error(error);
      });
  }
}
