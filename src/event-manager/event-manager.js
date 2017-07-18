ym.modules.define('shri2017.imageViewer.EventManager', [
    'util.extend'
], function (provide, extend) {

    var EVENTS = {
        mousedown: 'start',
        mousemove: 'move',
        mouseup: 'end',
        touchstart: 'start',
        touchmove: 'move',
        touchend: 'end',
        touchcancel: 'end',
        pointerdown: 'start',
        pointermove: 'move',
        pointerup: 'end',
        wheel: 'wheel'
    };

    function EventManager(elem, callback) {
        this._elem = elem;
        this._callback = callback;
        this._setupListeners();
    }

    extend(EventManager.prototype, {
        destroy: function () {
            this._teardownListeners();
        },

        // хеш поинтеров, максимум 2
        _pointers: {},

        _setupListeners: function () {
            // если поддерживаются PointerEvents, то работаем с ними, иначе используем TouchEvents
            if (window.PointerEvent) {
                this._pointerListener = this._pointerEventHandler.bind(this);
                this._pointerMoveListener = this._pointerMoveEventHandler.bind(this);
                this._pointerOutListener = this._pointerOutEventHandler.bind(this);
                this._addEventListeners('pointerdown pointerup', this._elem, this._pointerListener);
                this._elem.className += ' prevent-touch-actions';
            } else {
                this._mouseListener = this._mouseEventHandler.bind(this);
                this._touchListener = this._touchEventHandler.bind(this);
                this._addEventListeners('mousedown', this._elem, this._mouseListener);
                this._addEventListeners('touchstart touchmove touchend touchcancel', this._elem, this._touchListener);
            }
            // колесико мышки должно работать везде + тачпад
            this._wheelListener = this._wheelEventHandler.bind(this);
            this._addEventListeners('wheel', this._elem, this._wheelListener);
        },

        // отписываемся от всех возможных обработчиков
        _teardownListeners: function () {
            this._removeEventListeners('mousedown', this._elem, this._mouseListener);
            this._removeEventListeners('mousemove mouseup', document.documentElement, this._mouseListener);
            this._removeEventListeners('touchstart touchmove touchend touchcancel', this._elem, this._touchListener);
            this._removeEventListeners('pointerdown pointerup', this._elem, this._pointerListener);
            this._removeEventListeners('wheel', this._elem, this._wheelListener);
            this._removeEventListeners('pointermove', this._elem, this._pointerMoveListener);
            this._removeEventListeners('pointerout pointerover', this._elem, this._pointerOutListener);
            this._removeEventListeners('pointermove', document.documentElement, this._pointerMoveListener);
            this._removeEventListeners('pointerup', document.documentElement, this._pointerOutListener);
            this._removeEventListeners('pointerup', document.documentElement, this._pointerListener);
        },

        _addEventListeners: function (types, elem, callback) {
            types.split(' ').forEach(function (type) {
                elem.addEventListener(type, callback);
            }, this);
        },

        _removeEventListeners: function (types, elem, callback) {
            types.split(' ').forEach(function (type) {
                elem.removeEventListener(type, callback);
            }, this);
        },

        _mouseEventHandler: function (event) {
            event.preventDefault();

            if (event.type === 'mousedown') {
                this._addEventListeners('mousemove mouseup', document.documentElement, this._mouseListener);
            } else if (event.type === 'mouseup') {
                this._removeEventListeners('mousemove mouseup', document.documentElement, this._mouseListener);
            }

            var elemOffset = this._calculateElementOffset(this._elem);

            this._callback({
                type: EVENTS[event.type],
                targetPoint: {
                    x: event.clientX - elemOffset.x,
                    y: event.clientY - elemOffset.y
                },
                distance: 1
            });
        },

        _touchEventHandler: function (event) {
            event.preventDefault();

            var touches = event.touches;
            // touchend/touchcancel
            if (touches.length === 0) {
                touches = event.changedTouches;
            }

            var targetPoint;
            var distance = 1;
            var pointerType;
            var elemOffset = this._calculateElementOffset(this._elem);

            if (touches.length === 1) {
                pointerType = 'touch';
                targetPoint = {
                    x: touches[0].clientX,
                    y: touches[0].clientY
                };
            } else {
                var firstTouch = touches[0];
                var secondTouch = touches[1];
                targetPoint = this._calculateTargetPoint(firstTouch, secondTouch);
                distance = this._calculateDistance(firstTouch, secondTouch);
            }

            targetPoint.x -= elemOffset.x;
            targetPoint.y -= elemOffset.y;
            this._callback({
                type: EVENTS[event.type],
                targetPoint: targetPoint,
                distance: distance,
                pointer: pointerType
            });
        },

        // обработчик pointer-событий
        _pointerEventHandler: function (event) {
            event.preventDefault();

            // массивом id-шников удобно оперировать
            var ids = Object.keys(this._pointers);
            var elemOffset = this._calculateElementOffset(this._elem);

            if (event.type === 'pointerdown') {
                // не обрабатываем 3 и более касания
                if (ids.length > 1) {
                    return;
                }

                // при добавлении первого поинтера подписываемся на его движение и сохраняем его
                if (ids.length === 0) {
                    this._addEventListeners('pointermove', document.documentElement, this._pointerMoveListener);
                    this._callback({
                        type: EVENTS[event.type],
                        targetPoint: {
                            x: event.clientX - elemOffset.x,
                            y: event.clientY - elemOffset.y
                        },
                        distance: 1
                    });

                    this._savePointer(event);

                    // только для мышки подписываемся на выход за пределы элемента
                    // на сенсорных девайсах почему-то нет проблемы с прослушкой move за пределами элемента
                    if (event.pointerType === 'mouse') {
                        this._addEventListeners('pointerout pointerover', this._elem, this._pointerOutListener);
                    }
                }

                // если добавился второй поинтер, просто вызываем коллбек и посханяем поинтер
                if (ids.length === 1) {
                    this._callback({
                        type: EVENTS[event.type],
                        targetPoint: this._calculateTargetPoint(event, this._pointers[ids[0]]),
                        distance: this._calculateDistance(event, this._pointers[ids[0]])
                    });
                    this._savePointer(event);
                }
                // обработка удалившегося поинтера
            } else {
                // отписываемся от событий, если это был последний поинтер
                if (ids.length === 1) {
                    this._removeEventListeners('pointermove', document.documentElement, this._pointerMoveListener);

                    if (event.pointerType === 'mouse') {
                        this._removeEventListeners('pointerout pointerover', this._elem, this._pointerOutListener);
                        this._removeEventListeners('pointerup', document.documentElement, this._pointerListener);
                    }
                }

                var lastEvent = event;

                if (ids.length === 2) {
                    var lastPointerId = ids[0] == event.pointerId ? ids[1] : ids[0];
                    lastEvent = this._pointers[lastPointerId];
                }

                this._callback({
                    type: EVENTS[event.type],
                    targetPoint: {
                        x: lastEvent.clientX - elemOffset.x,
                        y: lastEvent.clientY - elemOffset.y
                    },
                    distance: 1
                });

                delete this._pointers[event.pointerId];
            }
        },

        // todo: объединить с _pointerEventHandler
        _pointerMoveEventHandler: function (event) {
            event.preventDefault();

            if (this._pointers[event.pointerId]) {
                this._savePointer(event);

                var ids = Object.keys(this._pointers);
                var targetPoint;
                var pointerType; // тип указателя - touch, mouse...
                var distance = 1;
                var elemOffset = this._calculateElementOffset(this._elem);

                if (ids.length === 1) {
                    pointerType = event.pointerType;
                    targetPoint = {
                        x: event.clientX,
                        y: event.clientY
                    };
                } else {
                    var secondId = ids[0] == event.pointerId ? ids[1] : ids[0];
                    var secondPointer = this._pointers[secondId];

                    targetPoint = this._calculateTargetPoint(event, secondPointer);
                    distance = this._calculateDistance(event, secondPointer);
                }

                targetPoint.x -= elemOffset.x;
                targetPoint.y -= elemOffset.y;

                this._callback({
                    type: EVENTS[event.type],
                    targetPoint: targetPoint,
                    distance: distance,
                    pointer: pointerType
                });
            }
        },

        // подписываемся или отписываемся от событий выхода за пределы элемента
        _pointerOutEventHandler: function (event) {
            if (event.type === 'pointerout') {
                this._addEventListeners('pointermove', document.documentElement, this._pointerMoveListener);
                this._addEventListeners('pointerup', document.documentElement, this._pointerOutListener);
                this._addEventListeners('pointerup', document.documentElement, this._pointerListener);
            } else {
                this._removeEventListeners('pointermove', document.documentElement, this._pointerMoveListener);
                this._removeEventListeners('pointerup', document.documentElement, this._pointerOutListener);
            }
        },

        // обработчик колеса мыши или увеличения тачпада
        _wheelEventHandler: function (event) {
            event.preventDefault();

            var elemOffset = this._calculateElementOffset(this._elem);
            this._callback({
                type: EVENTS[event.type],
                targetPoint: {
                    x: event.clientX - elemOffset.x,
                    y: event.clientY - elemOffset.y
                },
                delta: event.deltaY
            });
        },

        _calculateTargetPoint: function (firstTouch, secondTouch) {
            return {
                x: (secondTouch.clientX + firstTouch.clientX) / 2,
                y: (secondTouch.clientY + firstTouch.clientY) / 2
            };
        },

        _calculateDistance: function (firstTouch, secondTouch) {
            return Math.sqrt(
                Math.pow(secondTouch.clientX - firstTouch.clientX, 2) +
                Math.pow(secondTouch.clientY - firstTouch.clientY, 2)
            );
        },

        _calculateElementOffset: function (elem) {
            var bounds = elem.getBoundingClientRect();
            return {
                x: bounds.left,
                y: bounds.top
            };
        },

        // сохраняет поинтер в хеш
        _savePointer: function (pointer) {
            this._pointers[pointer.pointerId] = {
                clientX: pointer.clientX,
                clientY: pointer.clientY,
                type: pointer.type
            }
        }
    });

    provide(EventManager);
});
