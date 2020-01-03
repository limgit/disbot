import Discord from 'discord.js';
import { CustomCommand } from '@/core/types';
import db from '@/db';

import { dateToStr } from '@/utils/utils';

const { AVAILABLE_NAMES } = process.env;
if (!AVAILABLE_NAMES) throw Error('AVAILABLE_NAMES must be set');
const availableNames = AVAILABLE_NAMES.split(' ');

function validateName(message: Discord.Message, name: string) {
  const valid = availableNames.includes(name);
  if (!valid) {
    message.reply(`잘못된 이름이 포함되어 있습니다. 사용 가능한 이름: ${availableNames}`);
  }
  return valid;
}

const money: CustomCommand = {
  command: 'money',
  description: '돈 정산을 해줘요!',
  usage: [
    { description: '최근 10개의 채무 이력을 보여줍니다. 이름이 주어질 경우 해당 인물과 관계된 채무 이력만 보여집니다.', args: 'list [이름]' },
    { description: '현재 채무 상태를 보여줍니다. 이름이 주어질 경우 해당 인물의 채무 상태를 보여줍니다.', args: 'status [이름]' },
    { description: '채무 정보를 추가합니다', args: 'debt <금액(원)> <채권자> <채무자> [사유]' },
    { description: '더치페이 정보를 추가합니다', args: 'dutch <총 금액(원)> <자신 제외 더치페이 참여자 목록(쉼표 구분)> [사유]'},
    { description: '정산 정보를 추가합니다', args: 'clear <금액(원)> <채권자> <채무자> [사유]' },
  ],
  execute(message, argv) {
    if (argv.length === 1) {
      return message.reply('money 명령어는 최소 하나의 인자가 필요합니다. `!help money`를 통해 자세한 사용법을 확인할 수 있습니다.');
    }
    if (argv[1] === 'list') {
      if (argv[2] && !validateName(message, argv[2])) return;
      const promise = argv[2] ? db.getTransactions(10, argv[2]) : db.getTransactions(10);
      promise.then((rows) => {
        const logs = rows.map((row) => {
          const date = new Date(row.createdAt);
          const verb = row.amount > 0 ? '빌림' : '갚음';
          return `${dateToStr(date)} - ${row.toName}, ${row.fromName}에게 ${Math.abs(row.amount)}원 ${verb} (사유: ${row.reason})`;
        });
        const embed = new Discord.RichEmbed()
          .setColor('#00ff00')
          .setTitle('최근 채무 이력 (시간 역순)')
          .setDescription(logs.join('\n'));
        message.channel.send(embed);
      })
    } else if (argv[1] === 'status') {
      if (argv[2] && !validateName(message, argv[2])) return;
      const promise = argv[2] ? db.getBalances(argv[2]) : db.getBalances();
      promise.then((rows) => {
        const embed = new Discord.RichEmbed()
          .setColor('#00ff00')
          .setTitle('현재 채무 상태')
        const balance: { [a: string]: { [b: string]: number }} = {};
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!(row.nameA in balance)) balance[row.nameA] = Object();
          if (!(row.nameB in balance)) balance[row.nameB] = Object();
          balance[row.nameA][row.nameB] = row.debt;
          balance[row.nameB][row.nameA] = -row.debt;
        }
        Object.keys(balance).filter((name) => (!argv[2] || name === argv[2])).forEach((name) => {
          const debtInfo = balance[name];
          const debtSum = Object.keys(debtInfo).reduce((acc, curr) => acc + debtInfo[curr], 0);
          const adj = debtSum >= 0 ? '갚을' : '받을';
          const content = Object.keys(debtInfo).map((target) => {
            const a = debtInfo[target];
            return `${target}에게 ${a >= 0 ? '갚을' : '받을'} 돈 ${Math.abs(a)}원`;
          });
          embed.addField(
            `${name} (총 ${adj} 돈 ${Math.abs(debtSum)}원)`,
            content.join('\n'),
          );
        });
        message.channel.send(embed);
      })
    } else if (argv[1] === 'debt') {
      if (isNaN(argv[2] as any)) return message.reply('금액은 반드시 숫자여야 합니다');
      if (!validateName(message, argv[3]) || !validateName(message, argv[4])) return;
      const reason = argv[5] ?? '';
      db.addTransaction(argv[3], argv[4], reason, Number(argv[2])).then(() => {
        message.reply('채무 이력이 추가되었습니다');
      });
    } else if (argv[1] === 'dutch') {
      if (isNaN(argv[2] as any)) return message.reply('금액은 반드시 숫자여야 합니다');
      if (!validateName(message, argv[3])) return;
      const people = argv[4].split(',');
      if (people.some((person) => !validateName(message, person))) return;
      const val = Math.floor(Number(argv[2]) / (people.length + 1));
      const reason = argv[5] ?? '' + ' (더치)';
      people.map((name) => {
        db.addTransaction(argv[3], name, reason, val).then(() => {
          message.reply(`${name}과의 더치페이가 추가되었습니다.`);
        });
      });
    } else if (argv[1] === 'clear') {
      if (isNaN(argv[2] as any)) return message.reply('금액은 반드시 숫자여야 합니다');
      if (!validateName(message, argv[3]) || !validateName(message, argv[4])) return;
      const reason = argv[5] ?? '';
      db.addTransaction(argv[3], argv[4], reason, -Number(argv[2])).then(() => {
        message.reply('정산 이력이 추가되었습니다');
      });
    } else {
      message.reply(`알려지지 않은 인자입니다: ${argv[2]}. \`!help money\`를 통해 자세한 사용법을 확인할 수 있습니다.`);
    }
  }
}
export default money;
