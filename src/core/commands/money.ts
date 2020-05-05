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
  aliases: ['m'],
  usage: [
    { description: '최근 n개의 트랜잭션을 보여줍니다. 이름(들)이 주어질 경우 해당 인물(들)과 관계된 트랜잭션만 보여집니다.', args: 'list <n> [이름] [이름]' },
    { description: 'list 명령어의 별칭입니다', args: 'ls <n> [이름] [이름]'},
    { description: '현재 채무 상태를 보여줍니다. 이름이 주어질 경우 해당 인물의 채무 상태를 보여줍니다.', args: 'status [이름]' },
    { description: '트랜잭션을 추가합니다', args: 'transaction <금액(원)> <준 사람> <받은 사람> [사유]' },
    { description: 'transaction 명령어의 별칭입니다', args: 't <금액(원)> <준 사람> <받은 사람> [사유]' },
    { description: '더치페이 정보를 추가합니다', args: 'dutch <총 금액(원)> <돈 낸 사람> <돈 낸 사람 제외 더치페이 참여자 목록(쉼표 구분)> [사유]' },
    { description: '채무 청산에 최소 트랜잭션을 발생시키는 방법을 출력합니다', args: 'plan <청산할 사람 목록(쉼표 구분)>' },
    { description: '채무를 청산합니다', args: 'clear <청산할 사람 목록(쉼표 구분)>' },
  ],
  execute(message, argv) {
    if (argv.length === 1) {
      return message.reply('money 명령어는 최소 하나의 인자가 필요합니다. `!help money`를 통해 자세한 사용법을 확인할 수 있습니다.');
    }
    if (argv[1] === 'list' || argv[1] === 'ls') {
      if (isNaN(argv[2] as any)) return message.reply('트랜잭션 갯수는 반드시 숫자여야 합니다');
      const limit = Number(argv[2]);
      if (argv[3] && !validateName(message, argv[2])) return;
      if (argv[4] && !validateName(message, argv[3])) return;
      const promise = (() => {
        if (argv[3]) {
          if (argv[4]) return db.getTransactions(limit, argv[3], argv[4]);
          return db.getTransactions(limit, argv[3]);
        }
        return db.getTransactions(limit);
      })();
      promise.then((rows) => {
        const logs = rows.map((row) => {
          const date = new Date(row.createdAt);
          return `#${row.id}: ${dateToStr(date)} - ${row.fromName} ⇒ ${row.toName}: ${Math.abs(row.amount)}원 (사유: ${row.reason})`;
        });
        const embed = new Discord.RichEmbed()
          .setColor('#00ff00')
          .setTitle('최근 트랜잭션 (시간 역순)')
          .setDescription(logs.join('\n'));
        message.channel.send(embed);
      });
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
          const content = Object.keys(debtInfo).filter((target) => debtInfo[target] !== 0).map((target) => {
            const a = debtInfo[target];
            return `${target}에게 ${a >= 0 ? '갚을' : '받을'} 돈 ${Math.abs(a)}원`;
          });
          if (content.length !== 0) {
            embed.addField(
              `${name} (총 ${adj} 돈 ${Math.abs(debtSum)}원)`,
              content.join('\n'),
            );
          }
        });
        message.channel.send(embed);
      });
    } else if (argv[1] === 'transaction' || argv[1] === 't') {
      if (isNaN(argv[2] as any)) return message.reply('금액은 반드시 숫자여야 합니다');
      if (!validateName(message, argv[3]) || !validateName(message, argv[4])) return;
      const reason = argv[5] ?? '';
      db.addTransaction(argv[3], argv[4], reason, Number(argv[2])).then(() => {
        message.reply('트랜잭션이 추가되었습니다');
      });
    } else if (argv[1] === 'dutch') {
      if (isNaN(argv[2] as any)) return message.reply('금액은 반드시 숫자여야 합니다');
      if (!validateName(message, argv[3])) return;
      const people = argv[4].split(',');
      if (people.some((person) => !validateName(message, person))) return;
      const val = Math.floor(Number(argv[2]) / (people.length + 1));
      const reason = (argv[5] ?? '') + ' (더치)';
      people.map((name) => {
        db.addTransaction(argv[3], name, reason, val).then(() => {
          message.reply(`${name}와/과의 더치페이가 추가되었습니다.`);
        });
      });
    } else if (argv[1] === 'plan') {
      const people = argv[2].split(',');
      if (people.some((person) => !validateName(message, person))) return;
      if (people.length < 2) return message.reply('두 명 이상의 사람을 명시해주세요');
      db.getBalances().then((rows) => {
        const embed = new Discord.RichEmbed()
          .setColor('#00ff00')
          .setTitle(`${argv[2]} 정산 방법`);
        const totalDebt: { [name: string]: number } = {};
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!people.includes(row.nameA) || !people.includes(row.nameB)) continue; // Not the target
          if (!(row.nameA in totalDebt)) totalDebt[row.nameA] = 0;
          if (!(row.nameB in totalDebt)) totalDebt[row.nameB] = 0;
          totalDebt[row.nameA] += row.debt;
          totalDebt[row.nameB] -= row.debt;
        }
        const desc = Object.keys(totalDebt).map((name) => {
          const debt = totalDebt[name];
          const adj = debt > 0 ? '갚을' : '받을';
          if (debt === 0) return `${name}: 알짜 정산 금액이 없습니다`;
          return `${name}: 총 ${adj} 돈 ${Math.abs(debt)}원`;
        }).join('\n');
        embed.setDescription(desc);
        message.channel.send(embed);
      });
    } else if (argv[1] === 'clear') {
      const people = argv[2].split(',');
      if (people.some((person) => !validateName(message, person))) return;
      if (people.length < 2) return message.reply('두 명 이상의 사람을 명시해주세요');
      db.getBalances().then((rows) => {
        const transactPromises = rows.filter((row) => (
          people.includes(row.nameA) && people.includes(row.nameB)
        )).map((row) => {
          if (row.debt > 0) return db.addTransaction(row.nameA, row.nameB, `정산 (${argv[2]})`, Math.abs(row.debt));
          return db.addTransaction(row.nameB, row.nameA, `정산 (${argv[2]})`, Math.abs(row.debt));
        });
        Promise.all(transactPromises).then(() => {
          message.reply(`${argv[2]}의 정산이 완료되었습니다`);
        });
      })
    } else {
      message.reply(`알려지지 않은 인자입니다: ${argv[1]}. \`!help money\`를 통해 자세한 사용법을 확인할 수 있습니다.`);
    }
  }
}
export default money;
