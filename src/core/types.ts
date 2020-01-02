import Discord from 'discord.js';

export interface CustomCommand {
  command: string,
  description: string,
  usage: {
    description: string,
    args: string,
  }[],
  execute(message: Discord.Message, argv: string[]): void,
}
