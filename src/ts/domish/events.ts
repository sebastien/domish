// Project: DOMIsh
// Author:  Sebastien Pierre
// License: Revised BSD License
// Created: 2022-04-21

// Module: events
// A comprehensive DOM-compatible event implementation for server-side testing.
// Provides the full event hierarchy including Event, UIEvent, MouseEvent,
// KeyboardEvent, and specialized events. Supports event bubbling (no capture phase).
//
// Example:
// ```typescript
// const click = new MouseEvent("click", { clientX: 100, clientY: 200 });
// element.dispatchEvent(click);
// ```

import type { Element } from "./domish";

// ----------------------------------------------------------------------------
//
// EVENT PHASES
//
// ----------------------------------------------------------------------------

// Constant: EventPhase
// Numeric constants for event propagation phases.
export const EventPhase = {
	NONE: 0,
	CAPTURING_PHASE: 1,
	AT_TARGET: 2,
	BUBBLING_PHASE: 3,
} as const;

// ----------------------------------------------------------------------------
//
// BASE EVENT
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: Event Class
// ============================================================================

// Class: Event
// The base class for all DOM events. Defines standard event properties and
// methods for controlling event propagation.
//
// Properties:
// - type: string - event type (e.g., "click", "keydown")
// - target: EventTarget | null - the element that dispatched the event
// - currentTarget: EventTarget | null - the element currently handling the event
// - bubbles: boolean - whether the event bubbles up the DOM tree
// - cancelable: boolean - whether preventDefault() has an effect
// - composed: boolean - whether the event crosses shadow DOM boundaries
// - timeStamp: number - milliseconds since page load when event was created
// - eventPhase: number - current propagation phase (see EventPhase)
// - defaultPrevented: boolean - true if preventDefault() was called
export class Event {
	type: string;
	target: EventTarget | null;
	currentTarget: EventTarget | null;
	bubbles: boolean;
	cancelable: boolean;
	composed: boolean;
	timeStamp: number;
	eventPhase: number;
	defaultPrevented: boolean;
	private _propagationStopped: boolean;
	private _immediatePropagationStopped: boolean;
	private _path: EventTarget[];

	constructor(type: string, options: EventInit = {}) {
		this.type = type;
		this.target = null;
		this.currentTarget = null;
		this.bubbles = options.bubbles ?? false;
		this.cancelable = options.cancelable ?? false;
		this.composed = options.composed ?? false;
		this.timeStamp = Date.now();
		this.eventPhase = EventPhase.NONE;
		this.defaultPrevented = false;
		this._propagationStopped = false;
		this._immediatePropagationStopped = false;
		this._path = [];
	}

	// Method: preventDefault
	// Cancels the event if cancelable. Used to prevent default browser behavior.
	preventDefault(): void {
		if (this.cancelable) {
			this.defaultPrevented = true;
		}
	}

	// Method: stopPropagation
	// Stops event bubbling after the current handler completes.
	stopPropagation(): void {
		this._propagationStopped = true;
	}

	// Method: stopImmediatePropagation
	// Stops event propagation immediately; remaining handlers are not called.
	stopImmediatePropagation(): void {
		this._propagationStopped = true;
		this._immediatePropagationStopped = true;
	}

	// Method: composedPath
	// Returns an array of EventTargets that the event will bubble through.
	composedPath(): EventTarget[] {
		return [...this._path];
	}

	get _isPropagationStopped(): boolean {
		return this._propagationStopped;
	}

	get _isImmediatePropagationStopped(): boolean {
		return this._immediatePropagationStopped;
	}

	_setTarget(target: EventTarget): void {
		this.target = target;
	}

	_setCurrentTarget(currentTarget: EventTarget): void {
		this.currentTarget = currentTarget;
	}

	_setEventPhase(phase: number): void {
		this.eventPhase = phase;
	}

	_setPath(path: EventTarget[]): void {
		this._path = path;
	}
}

// ----------------------------------------------------------------------------
//
// UI EVENTS
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: UI Event
// ============================================================================

// Class: UIEvent
// Base class for user interface events. Extends Event with view and detail.
//
// Properties:
// - view: Window | null - the window that generated the event
// - detail: number - event-specific detail information
export class UIEvent extends Event {
	view: Window | null;
	detail: number;

	constructor(type: string, options: UIEventInit = {}) {
		super(type, options);
		this.view = options.view ?? null;
		this.detail = options.detail ?? 0;
	}
}

// Type: UIEventInit
// Options interface for UIEvent constructor.
export interface UIEventInit extends EventInit {
	view?: Window | null;
	detail?: number;
}

// ----------------------------------------------------------------------------
//
// MOUSE EVENTS
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: Mouse Event
// ============================================================================

// Class: MouseEvent
// Represents mouse interaction events (click, mousedown, mouseup, etc.).
// Extends UIEvent with position, button state, and modifier key information.
//
// Properties:
// - clientX, clientY: number - mouse position relative to viewport
// - screenX, screenY: number - mouse position relative to screen
// - button: number - mouse button (0=left, 1=middle, 2=right)
// - buttons: number - bitmask of pressed buttons
// - relatedTarget: EventTarget | null - secondary target (e.g., for mouseenter)
// - ctrlKey, shiftKey, altKey, metaKey: boolean - modifier key states
// - movementX, movementY: number - position change since last mouse event
// - pageX, pageY: number - mouse position relative to document
// - which: number - deprecated button identifier
export class MouseEvent extends UIEvent {
	clientX: number;
	clientY: number;
	screenX: number;
	screenY: number;
	button: number;
	buttons: number;
	relatedTarget: EventTarget | null;
	ctrlKey: boolean;
	shiftKey: boolean;
	altKey: boolean;
	metaKey: boolean;
	movementX: number;
	movementY: number;
	pageX: number;
	pageY: number;
	which: number;

	constructor(type: string, options: MouseEventInit = {}) {
		super(type, options);
		this.clientX = options.clientX ?? 0;
		this.clientY = options.clientY ?? 0;
		this.screenX = options.screenX ?? 0;
		this.screenY = options.screenY ?? 0;
		this.button = options.button ?? 0;
		this.buttons = options.buttons ?? 0;
		this.relatedTarget = options.relatedTarget ?? null;
		this.ctrlKey = options.ctrlKey ?? false;
		this.shiftKey = options.shiftKey ?? false;
		this.altKey = options.altKey ?? false;
		this.metaKey = options.metaKey ?? false;
		this.movementX = options.movementX ?? 0;
		this.movementY = options.movementY ?? 0;
		this.pageX = options.pageX ?? this.clientX;
		this.pageY = options.pageY ?? this.clientY;
		this.which = options.which ?? this.button + 1;
	}

	// Method: getModifierState
	// Returns true if the modifier key `keyArg` is pressed (Control, Shift, Alt, Meta).
	getModifierState(keyArg: string): boolean {
		switch (keyArg) {
			case "Control":
				return this.ctrlKey;
			case "Shift":
				return this.shiftKey;
			case "Alt":
				return this.altKey;
			case "Meta":
				return this.metaKey;
			default:
				return false;
		}
	}
}

// Type: MouseEventInit
// Options interface for MouseEvent constructor.
export interface MouseEventInit extends UIEventInit {
	clientX?: number;
	clientY?: number;
	screenX?: number;
	screenY?: number;
	button?: number;
	buttons?: number;
	relatedTarget?: EventTarget | null;
	ctrlKey?: boolean;
	shiftKey?: boolean;
	altKey?: boolean;
	metaKey?: boolean;
	movementX?: number;
	movementY?: number;
	pageX?: number;
	pageY?: number;
	which?: number;
}

// ----------------------------------------------------------------------------
//
// KEYBOARD EVENTS
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: Keyboard Event
// ============================================================================

// Class: KeyboardEvent
// Represents keyboard interaction events (keydown, keyup, keypress).
// Extends UIEvent with key information and modifier states.
//
// Properties:
// - key: string - the key value (e.g., "Enter", "a", "ArrowUp")
// - code: string - physical key code (e.g., "KeyA", "Enter")
// - location: number - key location (standard, left, right, numpad)
// - ctrlKey, shiftKey, altKey, metaKey: boolean - modifier key states
// - repeat: boolean - true if key is being held down
// - isComposing: boolean - true if composing an input method sequence
// - charCode, keyCode, which: number - deprecated key identifiers
//
// Static Constants:
// - DOM_KEY_LOCATION_STANDARD: number = 0
// - DOM_KEY_LOCATION_LEFT: number = 1
// - DOM_KEY_LOCATION_RIGHT: number = 2
// - DOM_KEY_LOCATION_NUMPAD: number = 3
export class KeyboardEvent extends UIEvent {
	key: string;
	code: string;
	location: number;
	ctrlKey: boolean;
	shiftKey: boolean;
	altKey: boolean;
	metaKey: boolean;
	repeat: boolean;
	isComposing: boolean;
	charCode: number;
	keyCode: number;
	which: number;

	static DOM_KEY_LOCATION_STANDARD = 0;
	static DOM_KEY_LOCATION_LEFT = 1;
	static DOM_KEY_LOCATION_RIGHT = 2;
	static DOM_KEY_LOCATION_NUMPAD = 3;

	constructor(type: string, options: KeyboardEventInit = {}) {
		super(type, options);
		this.key = options.key ?? "";
		this.code = options.code ?? "";
		this.location = options.location ?? KeyboardEvent.DOM_KEY_LOCATION_STANDARD;
		this.ctrlKey = options.ctrlKey ?? false;
		this.shiftKey = options.shiftKey ?? false;
		this.altKey = options.altKey ?? false;
		this.metaKey = options.metaKey ?? false;
		this.repeat = options.repeat ?? false;
		this.isComposing = options.isComposing ?? false;
		this.charCode = options.charCode ?? 0;
		this.keyCode = options.keyCode ?? 0;
		this.which = options.which ?? 0;
	}

	getModifierState(keyArg: string): boolean {
		switch (keyArg) {
			case "Control":
				return this.ctrlKey;
			case "Shift":
				return this.shiftKey;
			case "Alt":
				return this.altKey;
			case "Meta":
				return this.metaKey;
			default:
				return false;
		}
	}
}

export interface KeyboardEventInit extends UIEventInit {
	key?: string;
	code?: string;
	location?: number;
	ctrlKey?: boolean;
	shiftKey?: boolean;
	altKey?: boolean;
	metaKey?: boolean;
	repeat?: boolean;
	isComposing?: boolean;
	charCode?: number;
	keyCode?: number;
	which?: number;
}

// --
// ### Focus Event
export class FocusEvent extends UIEvent {
	relatedTarget: EventTarget | null;

	constructor(type: string, options: FocusEventInit = {}) {
		super(type, options);
		this.relatedTarget = options.relatedTarget ?? null;
	}
}

export interface FocusEventInit extends UIEventInit {
	relatedTarget?: EventTarget | null;
}

// --
// ### Input Event
export class InputEvent extends UIEvent {
	data: string | null;
	inputType: string;
	isComposing: boolean;

	constructor(type: string, options: InputEventInit = {}) {
		super(type, options);
		this.data = options.data ?? null;
		this.inputType = options.inputType ?? "insertText";
		this.isComposing = options.isComposing ?? false;
	}
}

export interface InputEventInit extends UIEventInit {
	data?: string | null;
	inputType?: string;
	isComposing?: boolean;
}

// --
// ### Composition Event
export class CompositionEvent extends UIEvent {
	data: string;

	constructor(type: string, options: CompositionEventInit = {}) {
		super(type, options);
		this.data = options.data ?? "";
	}
}

export interface CompositionEventInit extends UIEventInit {
	data?: string;
}

// --
// ### Wheel Event
export class WheelEvent extends MouseEvent {
	deltaX: number;
	deltaY: number;
	deltaZ: number;
	deltaMode: number;

	static DOM_DELTA_PIXEL = 0;
	static DOM_DELTA_LINE = 1;
	static DOM_DELTA_PAGE = 2;

	constructor(type: string, options: WheelEventInit = {}) {
		super(type, options);
		this.deltaX = options.deltaX ?? 0;
		this.deltaY = options.deltaY ?? 0;
		this.deltaZ = options.deltaZ ?? 0;
		this.deltaMode = options.deltaMode ?? WheelEvent.DOM_DELTA_PIXEL;
	}
}

export interface WheelEventInit extends MouseEventInit {
	deltaX?: number;
	deltaY?: number;
	deltaZ?: number;
	deltaMode?: number;
}

// --
// ### Data Transfer (for Drag/Clipboard)
export class DataTransfer {
	dropEffect: string;
	effectAllowed: string;
	files: FileList;
	items: DataTransferItemList;
	types: string[];
	private _data: Map<string, string>;

	constructor() {
		this.dropEffect = "none";
		this.effectAllowed = "uninitialized";
		this.files = [] as unknown as FileList;
		this.items = [] as unknown as DataTransferItemList;
		this.types = [];
		this._data = new Map();
	}

	clearData(format?: string): void {
		if (format === undefined) {
			this._data.clear();
		} else {
			this._data.delete(format);
		}
		this._updateTypes();
	}

	getData(format: string): string {
		return this._data.get(format) ?? "";
	}

	setData(format: string, data: string): void {
		this._data.set(format, data);
		this._updateTypes();
	}

	private _updateTypes(): void {
		this.types = Array.from(this._data.keys());
	}

	setDragImage(_image: Element, _x: number, _y: number): void {
		// No-op in server-side environment
	}
}

// --
// ### Drag Event
export class DragEvent extends MouseEvent {
	dataTransfer: DataTransfer | null;

	constructor(type: string, options: DragEventInit = {}) {
		super(type, options);
		this.dataTransfer = options.dataTransfer ?? null;
	}
}

export interface DragEventInit extends MouseEventInit {
	dataTransfer?: DataTransfer | null;
}

// --
// ### Clipboard Event
export class ClipboardEvent extends Event {
	clipboardData: DataTransfer | null;

	constructor(type: string, options: ClipboardEventInit = {}) {
		super(type, options);
		this.clipboardData = options.clipboardData ?? null;
	}
}

export interface ClipboardEventInit extends EventInit {
	clipboardData?: DataTransfer | null;
}

// --
// ### Touch
export class Touch {
	identifier: number;
	target: EventTarget;
	clientX: number;
	clientY: number;
	screenX: number;
	screenY: number;
	pageX: number;
	pageY: number;
	force: number;
	rotationAngle: number;
	radiusX: number;
	radiusY: number;

	constructor(options: TouchInit) {
		this.identifier = options.identifier ?? 0;
		this.target = options.target;
		this.clientX = options.clientX ?? 0;
		this.clientY = options.clientY ?? 0;
		this.screenX = options.screenX ?? 0;
		this.screenY = options.screenY ?? 0;
		this.pageX = options.pageX ?? this.clientX;
		this.pageY = options.pageY ?? this.clientY;
		this.force = options.force ?? 0;
		this.rotationAngle = options.rotationAngle ?? 0;
		this.radiusX = options.radiusX ?? 0;
		this.radiusY = options.radiusY ?? 0;
	}
}

export interface TouchInit {
	identifier?: number;
	target: EventTarget;
	clientX?: number;
	clientY?: number;
	screenX?: number;
	screenY?: number;
	pageX?: number;
	pageY?: number;
	force?: number;
	rotationAngle?: number;
	radiusX?: number;
	radiusY?: number;
}

// --
// ### Touch List
export class TouchList {
	private _touches: Touch[];

	constructor(touches: Touch[] = []) {
		this._touches = touches;
	}

	get length(): number {
		return this._touches.length;
	}

	item(index: number): Touch | null {
		return this._touches[index] ?? null;
	}

	*[Symbol.iterator](): Iterator<Touch> {
		for (const touch of this._touches) {
			yield touch;
		}
	}

	identifiedTouch(identifier: number): Touch | null {
		for (const touch of this._touches) {
			if (touch.identifier === identifier) {
				return touch;
			}
		}
		return null;
	}
}

// --
// ### Touch Event
export class TouchEvent extends UIEvent {
	touches: TouchList;
	targetTouches: TouchList;
	changedTouches: TouchList;
	altKey: boolean;
	metaKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;

	constructor(type: string, options: TouchEventInit = {}) {
		super(type, options);
		this.touches = new TouchList(options.touches ?? []);
		this.targetTouches = new TouchList(options.targetTouches ?? []);
		this.changedTouches = new TouchList(options.changedTouches ?? []);
		this.altKey = options.altKey ?? false;
		this.metaKey = options.metaKey ?? false;
		this.ctrlKey = options.ctrlKey ?? false;
		this.shiftKey = options.shiftKey ?? false;
	}
}

export interface TouchEventInit extends UIEventInit {
	touches?: Touch[];
	targetTouches?: Touch[];
	changedTouches?: Touch[];
	altKey?: boolean;
	metaKey?: boolean;
	ctrlKey?: boolean;
	shiftKey?: boolean;
}

// --
// ### Pointer Event
export class PointerEvent extends MouseEvent {
	pointerId: number;
	width: number;
	height: number;
	pressure: number;
	tangentialPressure: number;
	tiltX: number;
	tiltY: number;
	twist: number;
	pointerType: string;
	isPrimary: boolean;

	constructor(type: string, options: PointerEventInit = {}) {
		super(type, options);
		this.pointerId = options.pointerId ?? 0;
		this.width = options.width ?? 1;
		this.height = options.height ?? 1;
		this.pressure = options.pressure ?? 0;
		this.tangentialPressure = options.tangentialPressure ?? 0;
		this.tiltX = options.tiltX ?? 0;
		this.tiltY = options.tiltY ?? 0;
		this.twist = options.twist ?? 0;
		this.pointerType = options.pointerType ?? "mouse";
		this.isPrimary = options.isPrimary ?? false;
	}
}

export interface PointerEventInit extends MouseEventInit {
	pointerId?: number;
	width?: number;
	height?: number;
	pressure?: number;
	tangentialPressure?: number;
	tiltX?: number;
	tiltY?: number;
	twist?: number;
	pointerType?: string;
	isPrimary?: boolean;
}

// --
// ### Hash Change Event
export class HashChangeEvent extends Event {
	oldURL: string;
	newURL: string;

	constructor(type: string, options: HashChangeEventInit = {}) {
		super(type, options);
		this.oldURL = options.oldURL ?? "";
		this.newURL = options.newURL ?? "";
	}
}

export interface HashChangeEventInit extends EventInit {
	oldURL?: string;
	newURL?: string;
}

// --
// ### Pop State Event
export class PopStateEvent extends Event {
	state: any;

	constructor(type: string, options: PopStateEventInit = {}) {
		super(type, options);
		this.state = options.state ?? null;
	}
}

export interface PopStateEventInit extends EventInit {
	state?: any;
}

// --
// ### Submit Event
export class SubmitEvent extends Event {
	submitter: Element | null;

	constructor(type: string, options: SubmitEventInit = {}) {
		super(type, options);
		this.submitter = options.submitter ?? null;
	}
}

export interface SubmitEventInit extends EventInit {
	submitter?: Element | null;
}

// --
// ### Custom Event
export class CustomEvent extends Event {
	detail: any;

	constructor(type: string, options: CustomEventInit = {}) {
		super(type, options);
		this.detail = options.detail ?? null;
	}
}

export interface CustomEventInit extends EventInit {
	detail?: any;
}

// --
// ### Event Factory Functions
export function createMouseEvent(type: string, options: Partial<MouseEventInit> = {}): MouseEvent {
	return new MouseEvent(type, {
		bubbles: true,
		cancelable: true,
		...options,
	});
}

export function createKeyboardEvent(
	type: string,
	options: Partial<KeyboardEventInit> = {},
): KeyboardEvent {
	return new KeyboardEvent(type, {
		bubbles: true,
		cancelable: true,
		...options,
	});
}

export function createInputEvent(type: string, options: Partial<InputEventInit> = {}): InputEvent {
	return new InputEvent(type, {
		bubbles: true,
		cancelable: true,
		...options,
	});
}

export function createTouchEvent(
	type: string,
	target: EventTarget,
	options: Partial<TouchEventInit> = {},
): TouchEvent {
	const touch = new Touch({ target, ...options });
	return new TouchEvent(type, {
		bubbles: true,
		cancelable: true,
		touches: [touch],
		targetTouches: [touch],
		changedTouches: [touch],
		...options,
	});
}

export function createDragEvent(type: string, options: Partial<DragEventInit> = {}): DragEvent {
	return new DragEvent(type, {
		bubbles: true,
		cancelable: true,
		...options,
	});
}

export function createPointerEvent(
	type: string,
	options: Partial<PointerEventInit> = {},
): PointerEvent {
	return new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		...options,
	});
}

export function createWheelEvent(type: string, options: Partial<WheelEventInit> = {}): WheelEvent {
	return new WheelEvent(type, {
		bubbles: true,
		cancelable: true,
		...options,
	});
}

export function createFocusEvent(type: string, options: Partial<FocusEventInit> = {}): FocusEvent {
	return new FocusEvent(type, {
		bubbles: type !== "focus" && type !== "blur",
		cancelable: false,
		...options,
	});
}

export function createClipboardEvent(
	type: string,
	options: Partial<ClipboardEventInit> = {},
): ClipboardEvent {
	return new ClipboardEvent(type, {
		bubbles: true,
		cancelable: true,
		...options,
	});
}

export function createCustomEvent(
	type: string,
	options: Partial<CustomEventInit> = {},
): CustomEvent {
	return new CustomEvent(type, {
		bubbles: true,
		cancelable: true,
		...options,
	});
}

// ----------------------------------------------------------------------------
//
// ERROR EVENT
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: Error Event
// ============================================================================

// Class: ErrorEvent
// Represents script errors and exceptions.
//
// Properties:
// - message: string - error message
// - filename: string - URL of script where error occurred
// - lineno: number - line number where error occurred
// - colno: number - column number where error occurred
// - error: Error | null - the Error object
export class ErrorEvent extends Event {
	message: string;
	filename: string;
	lineno: number;
	colno: number;
	error: Error | null;

	constructor(type: string, options: ErrorEventInit = {}) {
		super(type, options);
		this.message = options.message ?? "";
		this.filename = options.filename ?? "";
		this.lineno = options.lineno ?? 0;
		this.colno = options.colno ?? 0;
		this.error = options.error ?? null;
	}
}

// ----------------------------------------------------------------------------
//
// EVENT TYPE REGISTRY
//
// ----------------------------------------------------------------------------

// Constant: eventTypes
// Maps event type names to their corresponding event classes.
export const eventTypes = {
	// Mouse events
	click: MouseEvent,
	dblclick: MouseEvent,
	mousedown: MouseEvent,
	mouseup: MouseEvent,
	mousemove: MouseEvent,
	mouseover: MouseEvent,
	mouseout: MouseEvent,
	mouseenter: MouseEvent,
	mouseleave: MouseEvent,
	contextmenu: MouseEvent,

	// Wheel events
	wheel: WheelEvent,

	// Keyboard events
	keydown: KeyboardEvent,
	keyup: KeyboardEvent,
	keypress: KeyboardEvent,

	// Focus events
	focus: FocusEvent,
	blur: FocusEvent,
	focusin: FocusEvent,
	focusout: FocusEvent,

	// Input events
	input: InputEvent,
	change: Event,
	beforeinput: InputEvent,

	// Composition events
	compositionstart: CompositionEvent,
	compositionupdate: CompositionEvent,
	compositionend: CompositionEvent,

	// Drag events
	drag: DragEvent,
	dragstart: DragEvent,
	dragend: DragEvent,
	dragenter: DragEvent,
	dragleave: DragEvent,
	dragover: DragEvent,
	drop: DragEvent,

	// Clipboard events
	copy: ClipboardEvent,
	cut: ClipboardEvent,
	paste: ClipboardEvent,

	// Touch events
	touchstart: TouchEvent,
	touchend: TouchEvent,
	touchmove: TouchEvent,
	touchcancel: TouchEvent,

	// Pointer events
	pointerdown: PointerEvent,
	pointerup: PointerEvent,
	pointermove: PointerEvent,
	pointerenter: PointerEvent,
	pointerleave: PointerEvent,
	pointerover: PointerEvent,
	pointerout: PointerEvent,
	pointercancel: PointerEvent,

	// Form events
	submit: SubmitEvent,
	reset: Event,

	// Document/Window events
	load: Event,
	unload: Event,
	beforeunload: Event,
	DOMContentLoaded: Event,
	readystatechange: Event,
	resize: UIEvent,
	scroll: UIEvent,
	hashchange: HashChangeEvent,
	popstate: PopStateEvent,
	error: ErrorEvent,
};

// Type: ErrorEventInit
// Options interface for ErrorEvent constructor.
export interface ErrorEventInit extends EventInit {
	message?: string;
	filename?: string;
	lineno?: number;
	colno?: number;
	error?: Error | null;
}

// EOF
