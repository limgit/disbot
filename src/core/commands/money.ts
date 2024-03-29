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
    { description: '최근 n개의 이벤트를 보여줍니다. 이름(들)이 주어질 경우 해당 인물(들)과 관계된 이벤트만 보여집니다.', args: 'ls <n> [이름] [이름]' },
    { description: '현재 채무 상태를 보여줍니다. 이름이 주어질 경우 해당 인물의 채무 상태를 보여줍니다.', args: 'st [이름]' },
    { description: '트랜잭션을 추가합니다', args: 't <금액(원)> <준 사람> <받은 사람> [코멘트]' },
    { description: '더치페이 정보를 추가합니다', args: 'd <총 금액(원)> <돈 낸 사람> <돈 낸 사람 제외 더치페이 참여자 목록(쉼표 구분)> [코멘트]' },
    { description: '마지막 이벤트의 등록을 취소합니다', args: 'undo'},
    { description: '두 사람의 채무를 청산합니다', args: 'clear [이름1] [이름2]' },
    { description: '채무 청산에 최소 트랜잭션을 발생시키는 방법을 출력합니다', args: 'plan <기준 사람> <기준 사람 제외 청산할 사람 목록(쉼표 구분)>' },
    { description: 'plan 명령어의 결과 상태대로 DB 상태를 조정합니다', args: 'arrange <기준 사람> <기준 사람 제외 청산할 사람 목록(쉼표 구분)>' },
  ],
  execute(message, argv) {
    if (argv.length === 1) {
      return message.reply('money 명령어는 최소 하나의 인자가 필요합니다. `!help money`를 통해 자세한 사용법을 확인할 수 있습니다.');
    }

    if (argv[1] === 'ls') {
      if (isNaN(argv[2] as any)) return message.reply('이벤트 갯수는 반드시 숫자여야 합니다');
      const limit = Number(argv[2]);
      const name1 = argv[3];
      const name2 = argv[4];
      if (name1 && !validateName(message, name1)) return;
      if (name2 && !validateName(message, name2)) return;
      const promise = (() => {
        if (name1) {
          if (name2) return db.getEvents(limit, name1, name2);
          return db.getEvents(limit, name1);
        }
        return db.getEvents(limit);
      })();
      promise.then((rows) => {
        const logs = rows.map((row) => {
          return `ID ${row.id}: ${dateToStr(row.createdAt)}, ${row.fromName} ⇒ ${row.toNames} (${row.eventType}): ${Math.abs(row.amount)}원 (${row.comment})`;
        });
        const embed = new Discord.EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('최근 이벤트 (시간 역순)')
          .setDescription(logs.join('\n'));
        message.channel.send({ embeds: [embed] });
      });
    }
    
    else if (argv[1] === 'st') {
      const name = argv[2];
      if (name && !validateName(message, name)) return;
      const promise = name ? db.getBalances(name) : db.getBalances();
      promise.then((rows) => {
        const embed = new Discord.EmbedBuilder()
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
            embed.addFields({
              name: `${name} (총 ${adj} 돈 ${Math.abs(debtSum)}원)`,
              value: content.join('\n'),
            });
          }
        });
        message.channel.send({ embeds: [embed] });
      });
    }

    else if (argv[1] === 't') {
      if (isNaN(argv[2] as any)) return message.reply('금액은 반드시 숫자여야 합니다');
      const amount = Number(argv[2]);
      const fromName = argv[3];
      const toName = argv[4];
      if (!validateName(message, fromName) || !validateName(message, toName)) return;
      if (fromName === toName) return message.reply('준 사람과 받은 사람이 같을 수 없습니다');
      const comment = argv.slice(5).join(' ');
      db.addTransaction(fromName, toName, comment, amount).then(() => {
        message.reply('트랜잭션이 추가되었습니다');
        if (comment === '') {
          message.reply('NOTE: 마지막 인자로 해당 트랜잭션의 코멘트를 추가할 수 있습니다');
        }
      });
    }
    
    else if (argv[1] === 'd') {
      if (isNaN(argv[2] as any)) return message.reply('금액은 반드시 숫자여야 합니다');
      const amount = Number(argv[2]);
      const fromName = argv[3]
      if (!validateName(message, fromName)) return;
      const toNames = argv[4].split(',');
      if (toNames.some((person) => !validateName(message, person))) return;
      if (toNames.includes(fromName)) return message.reply('더치페이 지불자가 더치페이 참여자에 포함될 수 없습니다');
      if ((new Set(toNames)).size !== toNames.length) return message.reply('더치페이 참여자는 모두 달라야 합니다');
      const comment = argv.slice(5).join(' ');
      db.addDutch(fromName, toNames, comment, amount).then(() => {
        message.reply('더치페이가 추가되었습니다');
        if (comment === '') {
          message.reply('NOTE: 마지막 인자로 해당 더치페이의 코멘트를 추가할 수 있습니다');
        }
      });
    }

    else if (argv[1] === 'undo') {
      db.undoEvent().then((res) => {
        if (res) message.reply('이벤트의 실행 취소가 완료되었습니다.');
        else message.reply('이벤트가 없습니다.');
      });
    }
    
    else if (argv[1] === 'clear') {
      const name1 = argv[2];
      const name2 = argv[3];
      if (!validateName(message, name1)) return;
      if (!validateName(message, name2)) return;
      if (name1 === name2) return message.reply('두 이름이 달라야 합니다');
      db.addClear(name1, name2).then((res) => {
        if (res) message.reply('정산 정보가 추가되었습니다.');
        else message.reply('정산할 채무가 없습니다.');
      });
    }
    
    else if (argv[1] === 'plan') {
      const standard = argv[2];
      if (!validateName(message, standard)) return;
      const people = argv[3].split(',');
      if (people.some((person) => !validateName(message, person))) return;
      if (people.length < 1) return message.reply('기준 사람을 제외하고 한 사람 이상이 필요합니다.');
      if (people.includes(standard)) return message.reply('기준 사람은 나머지 사람 목록에 포함될 수 없습니다');
      if ((new Set(people)).size !== people.length) return message.reply('나머지 사람 목록은 모두 달라야 합니다');
      const allPeople = [standard, ...people];
      db.getBalances().then((rows) => {
        const embed = new Discord.EmbedBuilder()
          .setColor('#00ff00')
          .setTitle(`${allPeople.join(',')} 정산 방법`)
          .setFooter({ text: '이 방법대로 정산하기 위해서는 arrange 명령어를 이용하세요.' });
        const totalDebt: { [name: string]: number } = {};
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!allPeople.includes(row.nameA) || !allPeople.includes(row.nameB)) continue; // Not the target
          if (!(row.nameA in totalDebt)) totalDebt[row.nameA] = 0;
          if (!(row.nameB in totalDebt)) totalDebt[row.nameB] = 0;
          totalDebt[row.nameA] += row.debt;
          totalDebt[row.nameB] -= row.debt;
        }
        const desc = Object.keys(totalDebt).filter((name) => name !== standard).map((name) => {
          const debt = totalDebt[name];
          const [from, to] = debt > 0 ? [name, standard] : [standard, name];
          return `${from}이(가) ${to}에게 ${Math.abs(debt)}원 송금하기`;
        }).join('\n');
        embed.setDescription(desc);
        message.channel.send({ embeds: [embed] });
      });
    }

    else if (argv[1] === 'arrange') {
      const standard = argv[2];
      if (!validateName(message, standard)) return;
      const people = argv[3].split(',');
      if (people.some((person) => !validateName(message, person))) return;
      if (people.length < 1) return message.reply('정리를 위해서는 기준 외에 한 명 이상의 사람이 더 필요합니다.');
      if (people.includes(standard)) return message.reply('기준 사람은 나머지 사람 목록에 포함될 수 없습니다');
      if ((new Set(people)).size !== people.length) return message.reply('나머지 사람 목록은 모두 달라야 합니다');
      const allPeople = [standard, ...people];
      const arrangeTs = Math.floor(new Date().getTime() / 1000);
      (async () => {
        await message.channel.send('정리 작업 시작. 완료시까지 다른 명령어를 사용하지 마세요.');
        const rows = await db.getBalances();
        await message.channel.send('채무 정리 계산 시작.');
        const totalDebt: { [name: string]: number } = {};
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!allPeople.includes(row.nameA) || !allPeople.includes(row.nameB)) continue; // Not the target
          if (!(row.nameA in totalDebt)) totalDebt[row.nameA] = 0;
          if (!(row.nameB in totalDebt)) totalDebt[row.nameB] = 0;
          totalDebt[row.nameA] += row.debt;
          totalDebt[row.nameB] -= row.debt;
        }
        await message.channel.send('채무 정리 계산 완료. 이전 채무 상태 초기화 시작.');
        for (let i = 0; i < allPeople.length; i++) {
          for (let j = i+1; j < allPeople.length; j++) {
            await db.addClear(allPeople[i], allPeople[j], `정리 작업-${arrangeTs}`);
          }
        }
        await message.channel.send('이전 채무 상태 초기화 완료. 정리된 상태로 채무 기록 재작성 시작.');
        const targetNames = Object.keys(totalDebt).filter((name) => name !== standard);
        for (let i = 0; i < targetNames.length; i++) {
          const targetName = targetNames[i];
          const debt = totalDebt[targetName];
          const [from, to] = debt > 0 ? [targetName, standard] : [standard, targetName];
          await db.addTransaction(to, from, `정리 작업-${arrangeTs}`, Math.abs(debt));
        }
      })().then(() => {
        message.channel.send('정리 작업이 완료되었습니다.');
      });
    }
    
    else {
      message.reply(`알려지지 않은 인자입니다: ${argv[1]}. \`!help money\`를 통해 자세한 사용법을 확인할 수 있습니다.`);
    }
  }
}
export default money;
