import 'module-alias/register';

import 'dotenv/config';
import Discord from 'discord.js';
import Winston from 'winston';
import commands from '@/core';

import { PREFIX } from '@/const';

const logger = Winston.createLogger({
  level: 'info',
  format: Winston.format.combine(
    Winston.format.timestamp(),
    Winston.format.printf(({ level, message, timestamp }) => (
      `${timestamp} [${level.toUpperCase()}] ${message}`
    )),
  ),
  transports: [
    new Winston.transports.Console(),
  ],
});

const client = new Discord.Client();

client.on('ready', () => {
  logger.info('Bot is now ready');
});

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

client.login(process.env.TOKEN);
