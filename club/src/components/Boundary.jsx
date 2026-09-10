import { Component } from 'react';

/* Последняя защита: если экран всё-таки упал, показываем понятный выход,
   а не чёрный прямоугольник. Чаще всего помогает сброс сохранённых данных. */

export default class Boundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { failed: true, message: error?.message || '' };
  }

  componentDidCatch(error) {
    console.error('Экран не открылся:', error);
  }

  reset = () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('iaiclub.'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* приватный режим — просто перезагрузимся */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="app">
        <div className="gate">
          <div className="gate__mark">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round">
              <path d="M12 8v5M12 16.5v.01M12 3 2 20h20z" />
            </svg>
          </div>
          <div className="center">
            <h1 className="h1">Приложение обновилось</h1>
            <p className="lead" style={{ marginTop: 8 }}>
              Данные, сохранённые прошлой версией, больше не подходят. Нажмите кнопку — приложение
              перезапустится с чистого листа.
            </p>
          </div>
          <button className="btn btn--accent btn--wide" onClick={this.reset}>Обновить и продолжить</button>
          {this.state.message && <div className="t-xs dim-2 center">{this.state.message}</div>}
        </div>
      </div>
    );
  }
}
