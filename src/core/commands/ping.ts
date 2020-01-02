import { CustomCommand } from '@/core/types';

const ping: CustomCommand = {
  command: 'ping',
  description: '봇에게 핑!',
  usage: [],
  execute(message, _) {
    message.reply('Pong!');
  }
}
export default ping;
