import 'module-alias/register';

import 'dotenv/config';
import Discord from 'discord.js';
import commands from '@/core';

import { PREFIX } from '@/const';

import logger from './logger';

const client = new Discord.Client();

client.on('ready', () => {
  logger.info('Bot is now ready');
});

// Regular commands
client.on('message', (message) => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const argv = message.content.slice(PREFIX.length).split(/ +/);
  const commandName = argv[0].toLowerCase();
  const command = commands.get(commandName);

  if (!command) {
    return message.reply(`\`${commandName}\` 명령어를 찾을 수 없습니다. \`${PREFIX}help\`로 사용 가능한 명령어를 확인할 수 있습니다.`);
  }

  try {
    command.execute(message, argv);
  } catch (error) {
    logger.error(argv);
    logger.error(error);
    const errmsg = [];
    errmsg.push(`명령어 \`${commandName}\`의 실행 중 에러가 발생했습니다.`);
    errmsg.push(`\`!help ${commandName}\`을 통해 사용법을 확인할 수 있습니다.`);
    message.reply(errmsg);
  }
});

// Special commands
client.on('message', (message) => {
  if (!message.content.includes('소라고둥님')) return;

  const ANSWERS = [
    '돼', '응', '좋아', '지금 당장', 'ㅇㅇ', '다시 한 번 물어봐', '그럼',
    '뭐라고?', '글쎄', '언젠가는', '안돼', 'ㄴ', '아아아아아아아아안돼',
    '하지마', '안된다니까?', '가만히 있어', '안.돼.', '그것도 안돼', '굶어',
    '차라리 군대를 가', '가능', '불가능',
  ];
  message.channel.send(ANSWERS[Math.floor(Math.random() * ANSWERS.length)]);
});

client.login(process.env.TOKEN);
