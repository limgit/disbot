import Discord from 'discord.js';

import { PREFIX } from '@/const';
import { CustomCommand } from './types';
import ping from './commands/ping';
import select from './commands/select';

const commandList = [
  ping,
  select,
];

const commands = new Discord.Collection<string, CustomCommand>();

commandList.forEach((command) => {
  commands.set(command.command, command);
});

// Help
const help: CustomCommand = {
  command: 'help',
  description: '사용 가능한 명령어에 대한 도움말입니다.',
  usage: '[command name]',
  execute(message, argv) {
    if (argv.length === 1) {
      const msg = [];
      msg.push('사용 가능한 명령어 목록은 다음과 같습니다:');
      msg.push(commandList.map(cmd => cmd.command).join(', '));
      msg.push(`\`${PREFIX}help [command name]\`을 통해 특정 명령어의 세부적인 사용법을 확인할 수 있습니다.`);
      return message.reply(msg, { split: true });
    }

    const commandName = argv[1];
    const command = commands.get(commandName);

    if (!command) {
      return message.reply(`\`${commandName}\` 명령어를 찾을 수 없습니다. \`${PREFIX}help\`로 사용 가능한 명령어를 확인할 수 있습니다.`);
    }

    const embed = new Discord.RichEmbed()
      .setColor('#00ff00')
      .setTitle(`\`${command.command}\``)
      .setDescription(command.description)
      .addField('사용법', `\`${PREFIX}${command.command} ${command.usage}\``);

    message.reply(embed);
  }
}
commands.set(help.command, help);

export default commands;
