import { ChatGPTAPI } from 'chatgpt';
import fetch from "node-fetch";

export class ChatGPT {
  private chatAPI: ChatGPTAPI;

  constructor(apikey: string) {
    this.chatAPI = new ChatGPTAPI({
      apiKey: apikey,
      apiBaseUrl:
        process.env.OPENAI_API_ENDPOINT || 'https://service-j43qbmsq-1307901475.sg.apigw.tencentcs.com/v1', // 代理 url => openai api
      completionParams: {
        model: process.env.MODEL || 'gpt-3.5-turbo',
        temperature: +(process.env.temperature || 0) || 1,
        top_p: +(process.env.top_p || 0) || 1,
        max_tokens: process.env.max_tokens
          ? +process.env.max_tokens
          : undefined,
      },
      fetch
    });
  }

  private generatePrompt = (patch: string) => {
    const language = process.env.LANGUAGE || '中文'
    const answerLanguage = language
      ? `使用${language}回答我,`
      : '';

    const prompt =
      process.env.PROMPT ||
        'Below is a code patch, please help me do a brief code review on it. Any bug risks and/or improvement suggestions are welcome:';

    return `${prompt}, ${answerLanguage}:
      ${patch}
    `;
  };

  public codeReview = async (patch: string) => {
    if (!patch) {
      return '';
    }

    console.time('code-review cost');
    const prompt = this.generatePrompt(patch);
    const res = await this.chatAPI.sendMessage(prompt);

    console.timeEnd('code-review cost');
    return res.text;
  };
}
