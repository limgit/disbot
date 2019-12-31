import Discord from 'discord.js';

export interface CustomCommand {
  command: string,
  description: string,
  usage: string,
  execute(message: Discord.Message, argv: string[]): void,
}
