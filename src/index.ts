import Gitlab from './gitlab';
import { logger } from './utils';

import { ChatGPT } from './chat.js';

import type { GitlabConfig, ChatGPTConfig } from './types';

async function run({
  gitlabConfig,
  chatgptConfig,
}: {
  gitlabConfig: GitlabConfig;
  chatgptConfig: ChatGPTConfig;
}) {
  const gitlab = new Gitlab(gitlabConfig);
  const chatgpt = new ChatGPT(chatgptConfig.apiKey)

  const res = await gitlab.getChanges();
  console.log('获取的gitlab代码变化', res);
  const { state, changes, ref } = res || {}
  if (state !== 'opened') {
    logger.log('MR is not opened');
    return;
  }

  if (!chatgpt) {
    logger.log('Chat is null');
    return;
  }

  for (let i = 0; i < changes.length; i += 1) {
    const change = changes[i];
    const message = await chatgpt.codeReview(change.diff);
    const result = await gitlab.addReviewComment({ message, ref, change });
    logger.info(message, result?.data);
  }
}

export default run;
