import Discord from 'discord.js';

import { CustomCommand } from './types';
import ping from './commands/ping';

const commandList = [
  ping,
];

const commands = new Discord.Collection<string, CustomCommand>();

commandList.forEach((command) => {
  commands.set(command.command, command);
});

export default commands;
