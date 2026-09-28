import { useApp } from '../lib/store.jsx';
import { go, back } from '../lib/router.jsx';
import Onboarding from '../components/onboarding/Onboarding.jsx';

/* Тест резидента — та же карточка регистрации, что у кандидата, но с
   подставленным профилем: резидент пролистывает и правит только то, что
   изменилось. Открывается после первого входа и заново из профиля
   (/test). Ответы уходят в профиль перед сборкой; «Позже» сохраняет то,
   что уже отмечено. */

export default function Test() {
  const app = useApp();
  return (
    <Onboarding
      app={app}
      initial={app.me}
      onCommit={(profile, answers) => {
        app.updateMe(profile);
        app.finishTest(answers);
      }}
      onEnter={() => go('/', true)}
      onLater={(profile, answers) => {
        app.updateMe({ ...profile, ...answers });
        go('/', true);
      }}
      onExit={() => back('/')}
    />
  );
}
