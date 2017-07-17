ym.modules.define('shri2017.imageViewer.GestureController', [
    'shri2017.imageViewer.EventManager',
    'util.extend'
], function (provide, EventManager, extend) {

    var DBL_TAP_STEP = 0.2;
    var WHEEL_STEP = 0.002;
    var ONE_TOUCH_ZOOM_STEP = 0.002;

    var Controller = function (view) {
        this._view = view;
        this._eventManager = new EventManager(
            this._view.getElement(),
            this._eventHandler.bind(this)
        );
        this._lastEventTypes = '';
    };

    extend(Controller.prototype, {
        destroy: function () {
            this._eventManager.destroy();
        },

        _timeoutId: null,
        _oneTouchZoomPrev: null,
        _oneTouchInitPoint: null,

        _eventHandler: function (event) {
            var state = this._view.getState();

            // dblclick
            if (!this._lastEventTypes) {
                clearTimeout(this._timeoutId);
                this._timeoutId = setTimeout(function () {
                    this._lastEventTypes = '';
                }.bind(this), 500);
            }
            this._lastEventTypes += ' ' + event.type;

            if (this._lastEventTypes.indexOf('start end start') > -1) {
                clearTimeout(this._timeoutId);

                if (this._lastEventTypes.indexOf('start end start end') > -1) {
                    this._lastEventTypes = '';
                    this._processDbltap(event);
                    return;
                }

                if (
                    this._oneTouchZoomPrev === null && event.pointer === 'touch' &&
                    this._lastEventTypes.indexOf('start end start move') > -1
                ) {
                    this._lastEventTypes = '';
                    this._oneTouchInitPoint = event.targetPoint;
                    this._oneTouchZoomPrev = event;
                    this._processOneTouchZoom(event);
                    return;
                }
            }

            if (event.type === 'end' && this._oneTouchZoomPrev !== null) {
                this._oneTouchZoomPrev = null;
            }

            if (event.type === 'wheel') {
                this._processWheel(event);
                return;
            }

            if (event.type === 'move') {
                if (event.distance > 1 && event.distance !== this._initEvent.distance) {
                    this._processMultitouch(event);
                } else if (this._oneTouchZoomPrev !== null) {
                    this._processOneTouchZoom(event);
                } else {
                    this._processDrag(event);
                }
            } else {
                this._initState = this._view.getState();
                this._initEvent = event;
            }
        },

        _processDrag: function (event) {
            this._view.setState({
                positionX: this._initState.positionX + (event.targetPoint.x - this._initEvent.targetPoint.x),
                positionY: this._initState.positionY + (event.targetPoint.y - this._initEvent.targetPoint.y)
            });
        },

        _processMultitouch: function (event) {
            this._scale(
                event.targetPoint,
                this._initState.scale * (event.distance / this._initEvent.distance)
            );
        },

        _processDbltap: function (event) {
            var state = this._view.getState();
            this._scale(
                event.targetPoint,
                state.scale + DBL_TAP_STEP
            );
        },

        _processWheel: function (event) {
            var state = this._view.getState();
            this._scale(
                event.targetPoint,
                state.scale - WHEEL_STEP * event.delta
            );
        },

        _processOneTouchZoom: function (event) {
            var state = this._view.getState();
            var prevPoint = this._oneTouchZoomPrev.targetPoint;
            this._scale(
                this._oneTouchInitPoint,
                state.scale - (prevPoint.y - event.targetPoint.y) * ONE_TOUCH_ZOOM_STEP
            );
            this._oneTouchZoomPrev = event;
        },

        _scale: function (targetPoint, newScale) {
            newScale = Math.max(Math.min(newScale, 10), 0.02);
            var imageSize = this._view.getImageSize();
            var state = this._view.getState();
            // Позиция прикосновения на изображении на текущем уровне масштаба
            var originX = targetPoint.x - state.positionX;
            var originY = targetPoint.y - state.positionY;
            // Размер изображения на текущем уровне масштаба
            var currentImageWidth = imageSize.width * state.scale;
            var currentImageHeight = imageSize.height * state.scale;
            // Относительное положение прикосновения на изображении
            var mx = originX / currentImageWidth;
            var my = originY / currentImageHeight;
            // Размер изображения с учетом нового уровня масштаба
            var newImageWidth = imageSize.width * newScale;
            var newImageHeight = imageSize.height * newScale;
            // Рассчитываем новую позицию с учетом уровня масштаба
            // и относительного положения прикосновения
            state.positionX += originX - (newImageWidth * mx);
            state.positionY += originY - (newImageHeight * my);
            // Устанавливаем текущее положение мышки как "стержневое"
            state.pivotPointX = targetPoint.x;
            state.pivotPointY = targetPoint.y;
            // Устанавливаем масштаб и угол наклона
            state.scale = newScale;
            this._view.setState(state);
        }
    });

    provide(Controller);
});
