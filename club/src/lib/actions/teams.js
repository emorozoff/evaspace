/* Команды: заявки, состав, роли, приглашения, выручка и голосования. */
import { uid } from '../format.js';
import { DAY } from '../time.js';
import { ensureEvents } from '../events.js';
import { teamSize, voteSummary, MAX_TEAM } from '../logic.js';
import { note } from '../rules.js';

export default function reduce(state, action, ctx) {
  const { now, user, withToast, award, notifyTeam, settleVote, root } = ctx;

  switch (action.type) {
    /* ---------- команды: распределяет куратор ---------- */

    case 'apply': {
      if (!user) return state;
      const applications = state.applications.filter((a) => !(a.userId === user.id && a.status === 'pending'));
      return withToast(
        {
          ...state,
          applications: [
            ...applications,
            {
              id: uid('ap'),
              userId: user.id,
              role: action.role,
              hours: action.hours,
              aim: action.aim || [],
              field: action.field || [],
              about: action.about || '',
              at: now,
              status: 'pending',
            },
          ],
        },
        'Заявка у куратора'
      );
    }

    case 'applyCancel':
      return withToast({ ...state, applications: state.applications.filter((a) => !(a.userId === user?.id && a.status === 'pending')) }, 'Заявка отозвана');

    case 'teamCreate': {
      const id = uid('t');
      const team = {
        id,
        name: action.name.trim(),
        idea: (action.idea || '').trim(),
        captainId: action.captainId || null,
        seasonId: state.season.id,
        chatUrl: '',
        createdAt: now,
      };
      const next = { ...state, teams: [...state.teams, team] };
      return withToast({ ...next, events: [...next.events, ...ensureEvents(next, now)] }, 'Команда создана');
    }

    case 'teamCover':
      return withToast({ ...state, teams: state.teams.map((t) => (t.id === action.teamId ? { ...t, cover: action.cover } : t)) }, 'Обложка обновлена');

    /** Куратор применяет план, собранный ИИ. */
    case 'applyPlan': {
      let next = state;
      for (const step of action.plan) {
        next = root(next, { type: 'assign', teamId: step.teamId, userId: step.userId, role: step.role, silent: true, now });
      }
      return withToast(next, `Распределено: ${action.plan.length}`);
    }

    case 'teamPatch':
      return withToast({ ...state, teams: state.teams.map((t) => (t.id === action.teamId ? { ...t, ...action.patch } : t)) }, 'Сохранено');

    /** Куратор определяет участника в команду. */
    case 'assign': {
      if (teamSize(state, action.teamId) >= MAX_TEAM) return withToast(state, 'В команде уже 10 человек');
      const team = state.teams.find((t) => t.id === action.teamId);
      if (!team) return state;
      const members = state.members.filter((m) => m.userId !== action.userId);
      const application = state.applications.find((a) => a.userId === action.userId && a.status === 'pending');
      return withToast(
        {
          ...state,
          members: [...members, { teamId: team.id, userId: action.userId, role: action.role || application?.role || 'участник', joinedAt: now }],
          applications: state.applications.map((a) => (a.userId === action.userId && a.status === 'pending' ? { ...a, status: 'assigned', teamId: team.id } : a)),
          teams: state.teams.map((t) => (t.id === team.id && !t.captainId ? { ...t, captainId: action.userId } : t)),
          notes: [...state.notes, note(`assigned-${team.id}-${action.userId}-${now}`, action.userId, 'Вы в команде', `Куратор определил вас в команду «${team.name}».`, '/team', now)],
        },
        action.silent ? null : 'Участник в команде'
      );
    }

    case 'unassign': {
      const members = state.members.filter((m) => !(m.teamId === action.teamId && m.userId === action.userId));
      const rest = members.filter((m) => m.teamId === action.teamId);
      return withToast(
        {
          ...state,
          members,
          teams: state.teams.map((t) => (t.id === action.teamId && t.captainId === action.userId ? { ...t, captainId: rest[0]?.userId || null } : t)),
        },
        'Участник убран из команды'
      );
    }

    /** Капитан раздаёт роли и назначает помощника. */
    case 'teamRole':
      return withToast(
        { ...state, members: state.members.map((m) => (m.teamId === action.teamId && m.userId === action.userId ? { ...m, role: action.role } : m)) },
        'Роль обновлена'
      );

    case 'teamTitle': {
      const team = state.teams.find((t) => t.id === action.teamId);
      if (!team) return state;
      const patch = action.title === 'captain' ? { captainId: action.userId } : { mateId: action.userId === team.mateId ? null : action.userId };
      return withToast({ ...state, teams: state.teams.map((t) => (t.id === team.id ? { ...t, ...patch } : t)) }, action.title === 'captain' ? 'Новый капитан' : 'Помощник назначен');
    }

    /** Усиление команды: участник зовёт человека, тот решает сам. */
    case 'invite': {
      if (state.invites.some((i) => i.userId === action.userId && i.status === 'pending')) return withToast(state, 'Этого человека уже позвали');
      const team = state.teams.find((t) => t.id === action.teamId);
      const id = uid('iv');
      return withToast(
        {
          ...state,
          invites: [...state.invites, { id, teamId: action.teamId, userId: action.userId, fromId: user?.id, at: now, status: 'pending' }],
          notes: [...state.notes, note(`invite-${id}`, action.userId, 'Вас зовут в команду', `«${team?.name}» приглашает вас усилить команду.`, '/team', now)],
        },
        'Приглашение отправлено'
      );
    }

    case 'inviteAnswer': {
      const invite = state.invites.find((i) => i.id === action.id);
      if (!invite) return state;
      const invites = state.invites.map((i) => (i.id === invite.id ? { ...i, status: action.accept ? 'accepted' : 'declined' } : i));
      if (!action.accept) return withToast({ ...state, invites }, 'Приглашение отклонено');
      const application = state.applications.find((a) => a.userId === invite.userId && a.status === 'pending');
      const next = root({ ...state, invites }, { type: 'assign', teamId: invite.teamId, userId: invite.userId, role: application?.role || user?.facts?.role?.[0], silent: true, now });
      // Тот, кто позвал, получает благодарность в бонусах: команда стала сильнее
      const bonus = 500;
      return withToast(
        {
          ...next,
          users: next.users.map((u) => (u.id === invite.fromId ? { ...u, bonus: (u.bonus || 0) + bonus } : u)),
          bonusLog: [...next.bonusLog, { id: uid('b'), userId: invite.fromId, amount: bonus, reason: 'Привёл человека в команду', at: now }],
        },
        'Добро пожаловать в команду'
      );
    }

    /* ---------- голосования команды ---------- */

    /** Предложение выносится на голосование. Голос автора сразу «за». */
    case 'voteStart': {
      if (!user) return state;
      const team = state.teams.find((t) => t.id === action.teamId);
      if (!team) return state;
      const vote = {
        id: uid('vt'),
        teamId: team.id,
        kind: action.kind,
        proposal: action.proposal,
        byId: user.id,
        at: now,
        votes: { [user.id]: 'yes' },
        status: 'open',
      };
      const title = action.kind === 'goal' ? 'Предложена новая цель' : 'Предложено новое время созвона';
      let next = { ...state, votes: [...(state.votes || []), vote] };
      next = notifyTeam(next, team, user, title, `${user.name} предлагает: ${voteSummary(vote)}. Решение принимается единогласно.`, '/team', now);
      // Голос автора может оказаться единственным — тогда решение сразу принято
      return withToast(settleVote(next, vote.id, now), 'Отправили команде на голосование');
    }

    case 'voteCast': {
      if (!user) return state;
      const vote = (state.votes || []).find((v) => v.id === action.id);
      if (!vote || vote.status !== 'open') return state;
      const next = {
        ...state,
        votes: state.votes.map((v) => (v.id === vote.id ? { ...v, votes: { ...v.votes, [user.id]: action.yes ? 'yes' : 'no' } } : v)),
      };
      return withToast(settleVote(next, vote.id, now), action.yes ? 'Голос «за» учтён' : 'Голос «против» учтён');
    }

    case 'voteCancel': {
      const vote = (state.votes || []).find((v) => v.id === action.id);
      if (!vote || vote.byId !== user?.id) return state;
      return withToast({ ...state, votes: state.votes.filter((v) => v.id !== action.id) }, 'Предложение снято');
    }

    /* ---------- выручка и копилка ---------- */

    case 'revenueAdd': {
      if (!user) return state;
      const entry = {
        id: uid('r'),
        teamId: action.teamId,
        userId: user.id,
        amount: Math.round(action.amount) || 0,
        hours: Math.round(action.hours) || 0,
        comment: action.comment || '',
        proof: action.proof || '',
        at: now,
        editableUntil: now + 2 * DAY,
      };
      return withToast(award({ ...state, revenue: [...state.revenue, entry] }, user.id, 'revenue'), `Записано ${entry.amount.toLocaleString('ru-RU')} ₽`);
    }

    case 'revenueEdit':
      return withToast(
        { ...state, revenue: state.revenue.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)) },
        'Запись изменена'
      );

    case 'revenueDelete':
      return withToast({ ...state, revenue: state.revenue.filter((r) => r.id !== action.id) }, 'Запись удалена');

    case 'contributionAdd':
      return withToast(
        {
          ...state,
          contributions: [
            ...state.contributions,
            { id: uid('k'), teamId: action.teamId, amount: Math.round(action.amount) || 0, proof: action.proof || '', confirmed: false, at: now },
          ],
        },
        'Взнос отмечен. Админ подтвердит его вручную'
      );

    case 'contributionConfirm':
      return withToast(
        { ...state, contributions: state.contributions.map((c) => (c.id === action.id ? { ...c, confirmed: action.value } : c)) },
        'Готово'
      );

    default:
      return undefined;
  }
}
