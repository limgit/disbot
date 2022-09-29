import 'module-alias/register';

import 'dotenv/config';
import Discord from 'discord.js';
import commands from '@/core';

import { PREFIX } from '@/const';

import logger from './logger';
import db from './db';
import { getMeta } from './utils/utils';

const { TOKEN, } = process.env;
if (!TOKEN) throw Error('TOKEN must be set');

const client = new Discord.Client({ intents: [Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildMessages, Discord.GatewayIntentBits.GuildMessageReactions, Discord.GatewayIntentBits.MessageContent] });

client.on('ready', () => {
  logger.info(`Bot is now ready as ${client.user!.tag}!`);
});

// Regular commands
client.on('messageCreate', (message) => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const argv = message.content.slice(PREFIX.length).split(/ +/);
  const commandName = argv[0].toLowerCase();
  const command = commands.get(commandName);

  if (!command) {
    message.reply(`\`${commandName}\` 명령어를 찾을 수 없습니다. \`${PREFIX}help\`로 사용 가능한 명령어를 확인할 수 있습니다.`);
    return;
  }

  try {
    command.execute(message, argv);
  } catch (error) {
    logger.error(argv);
    logger.error(error);
    const errmsg = [];
    errmsg.push(`명령어 \`${commandName}\`의 실행 중 에러가 발생했습니다.`);
    errmsg.push(`\`!help ${commandName}\`을 통해 사용법을 확인할 수 있습니다.`);
    message.reply({ content: errmsg.join("\n") });
  }
});

// Special commands
client.on('messageCreate', (message) => {
  if (!message.content.includes('소라고둥님')) return;

  const ANSWERS = [
    '돼', '응', '좋아', '지금 당장', 'ㅇㅇ', '다시 한 번 물어봐', '그럼',
    '뭐라고?', '글쎄', '언젠가는', '안돼', 'ㄴ', '아아아아아아아아안돼',
    '하지마', '안된다니까?', '가만히 있어', '안.돼.', '그것도 안돼', '굶어',
    '차라리 군대를 가', '가능', '불가능',
  ];
  message.channel.send(ANSWERS[Math.floor(Math.random() * ANSWERS.length)]);
});

// Baseball game
function getBaseballResult(target: string, answer: string) {
  let s = 0;
  let b = 0;
  const targetLi = target.split('');
  const answerLi = answer.split('');
  // Get strikes
  for (let i = 0; i < target.length; i++) {
    if (targetLi[i] === answerLi[i]) {
      // Same position, same number
      s += 1;
      // Remove it so that it never counts twice
      targetLi[i] = '';
      answerLi[i] = '';
    }
  }
  // Time for balls
  for (let i = 0; i < target.length; i++) {
    if (targetLi[i] === '') continue;
    const pos = answerLi.findIndex((v) => v === targetLi[i]);
    if (pos > -1) {
      b += 1;
      // Remove it so that it never counts twice
      targetLi[i] = '';
      answerLi[pos] = '';
    }
  }
  return {
    s,
    b,
  };
}
const NUM_REGEX = /^\d+$/;
client.on('messageCreate', (message) => {
  const { content } = message;
  if (!NUM_REGEX.test(content)) return;

  const authorId = message.author.id;
  (async () => {
    const res = await db.getBaseballSession(authorId);
    if (res === false) return;
    const meta = getMeta(res.meta);
    if (meta.digits !== content.length) return;
    if (!meta.allowDuplicates && new Set(content.split('')).size !== content.length) return message.reply('중복된 숫자를 포함할 수 없습니다.');
    if (content.split('').filter((e: any) => Number(e) > meta.maxNum).length !== 0) return message.reply(`0에서 ${meta.maxNum}까지의 숫자만 사용할 수 있습니다.`);

    const thisTrial = res.trial + 1;
    const { s, b } = getBaseballResult(content, res.answer);
    const logs = [...res.log, `${content}: ${s}S ${b}B`];
    const logStr = logs.map((e, i) => `${i + 1}번째 시도 - ${e}`).join('\n');
    if (s !== meta.digits) {
      // Not finished
      const { trialLimit } = meta;
      if (trialLimit !== -1 && trialLimit <= thisTrial) {
        await db.dropBaseballSession(authorId);
        message.reply(`정해진 ${trialLimit}회의 시도 내에 정답을 찾지 못해 패배했습니다. 세션을 종료합니다.\n시도 로그:\n${logStr}`);
      } else {
        await db.updateBaseballSession(authorId, thisTrial, logs);
        message.reply(`${thisTrial}번째 시도: ${s}S ${b}B${trialLimit === -1 ? '' : `, 남은 시도 횟수 ${trialLimit - thisTrial}`}`);
      }
    } else {
      // Finished!
      await db.dropBaseballSession(authorId);
      message.reply(`총 ${thisTrial}번의 시도만에 정답 ${res.answer}를 맞췄습니다! 세션을 종료합니다.\n시도 로그:\n${logStr}`);
    }
  })().catch((err) => {
    message.reply(`에러가 발생했습니다: ${JSON.stringify(err)}`);
  });
});

client.login(TOKEN);
