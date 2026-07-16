/**
 * 输入采集：WASD/方向键移动、鼠标瞄准、点击/按住开火、R 换弹、1-4 切枪、滚轮循环、ESC 暂停。
 * 引擎每帧读取瞬时状态；离散事件（切枪/换弹/暂停）走回调。
 */

export interface InputCallbacks {
  onSlotKey: (slot: number) => void;
  onReload: () => void;
  onCycle: (dir: 1 | -1) => void;
  onPause: () => void;
}

const MOVE_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
]);

export class Input {
  keys = new Set<string>();
  /** 鼠标相对 canvas 的 CSS 像素坐标 */
  mouseX = 0;
  mouseY = 0;
  /** 左键按住 */
  firing = false;
  /** 本帧有点击沿（半自动用） */
  clickEdge = false;
  mouseActive = false;

  private cb: InputCallbacks;
  private el: HTMLElement;
  private destroyed = false;

  constructor(el: HTMLElement, cb: InputCallbacks) {
    this.el = el;
    this.cb = cb;
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('blur', this.onBlur);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) {
      if (MOVE_KEYS.has(e.code)) e.preventDefault();
      return;
    }
    this.keys.add(e.code);
    if (e.code === 'Escape') {
      this.cb.onPause();
      return;
    }
    if (MOVE_KEYS.has(e.code)) e.preventDefault();
    if (e.code === 'KeyR') this.cb.onReload();
    if (e.code === 'Digit1') this.cb.onSlotKey(0);
    if (e.code === 'Digit2') this.cb.onSlotKey(1);
    if (e.code === 'Digit3') this.cb.onSlotKey(2);
    if (e.code === 'Digit4') this.cb.onSlotKey(3);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.el.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
    this.mouseActive = true;
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.firing = true;
      this.clickEdge = true;
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.firing = false;
  };

  private onWheel = (e: WheelEvent): void => {
    const rect = this.el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
      e.preventDefault();
      this.cb.onCycle(e.deltaY > 0 ? 1 : -1);
    }
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.firing = false;
  };

  /** 移动轴（归一化） */
  moveAxis(out: { x: number; y: number }): void {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.sqrt(2);
      x *= inv;
      y *= inv;
    }
    out.x = x;
    out.y = y;
  }

  endFrame(): void {
    this.clickEdge = false;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    this.el.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.onBlur);
  }
}
