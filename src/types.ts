export type  GitlabConfig = {
  host: string; // gitlab 域名
  token: string; // gitlab access token
  projectId: string | number; // gitlab 项目 id
  mrIId: string | number; // gitlab mr id
  target?: RegExp; // 要 review 的项目正则
}

export type ChatGPTConfig = {
  apiKey: string;
  model?: string;
  temperature?: number;
  top_p?: number;
  language?: string;
  proxyHost?: string
}
export interface GitlabDiffRef {
  baseSha: string;
  headSha: string;
  startSha: string;
}

export interface GitlabChange {
  newPath: string;
  oldPath: string;
  newFile: boolean; // 是否是新添加文件
  renamedFile: boolean; // 是否是重命名文件
  deletedFile: boolean; // 是否是删除文件
  diff: string; // 类似 "--- a/VERSION\ +++ b/VERSION\ @@ -1 +1 @@\ -1.9.7\ +1.9.8"
  lastNewLine?: number;
  lastOldLine?: number;
}
