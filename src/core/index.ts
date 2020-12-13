import Discord from 'discord.js';

import { PREFIX } from '@/const';
import { CustomCommand } from './types';
import ping from './commands/ping';
import select from './commands/select';
import dice from './commands/dice';
import money from './commands/money';
import baseball from './commands/baseball';

const commandList = [
  ping,
  select,
  dice,
  money,
  baseball,
];
commandList.sort((a, b) => {
  if (a.command < b.command) return -1;
  if (a.command === b.command) return 0;
  return 1;
});

const commands = new Discord.Collection<string, CustomCommand>();

commandList.forEach((command) => {
  commands.set(command.command, command);
  if (command.aliases) {
    command.aliases.forEach((alias) => commands.set(alias, command));
  }
});

// Help
const help: CustomCommand = {
  command: 'help',
  description: '사용 가능한 명령어에 대한 도움말입니다.',
  usage: [
    { description: '주어진 명령어에 대한 도움말을 보입니다', args: '[command_name]' }
  ],
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

    const embed = new Discord.MessageEmbed()
      .setColor('#00ff00')
      .setTitle(`\`${command.command}\``)
      .setDescription(command.description);

    if (command.aliases) {
      embed.addField('별칭 목록', command.aliases.join(', '));
    }

    if (command.usage.length === 0) {
      embed.addField('사용법', `\`${PREFIX}${command.command}\``);
    } else {
      command.usage.forEach((v, i) => {
        const text = `\`${PREFIX}${command.command} ${v.args}\`\n${v.description}`;
        embed.addField(`사용법 ${i+1}`, text);
      });
    }

    message.reply(embed);
  }
}
commands.set(help.command, help);

export default commands;
