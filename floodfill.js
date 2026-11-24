/**
 * Битовая маска для канвы, хранящая обработанные пиксели
 *
 * @param width ширина канвы
 * @param height высота канвы
 * @constructor Конструктор принимает ширину и высоту канвы
 */
function CanvasBitMask(width, height) {
    var intWidth = Math.ceil(width / 32);

    var bits = new Array(intWidth * height);
    bits.fill(0 << 0);

    var holderIndex = function (x, y) {
        if (x >= width || y >= height) throw "Out of canvas bounds";
        return (y * intWidth) + Math.floor(x / 32);
    }

    var isSet = function (x, y) {
        var index = holderIndex(x, y);
        var holder = bits[index];
        var bit = x % 32;
        return ((holder >>> (31 - bit)) & 0x1) > 0;
    }

    this.isBitSet = function (x, y) {
        return isSet(x, y);
    }

    this.compareAndSetBit = function (x, y) {
        var alreadySet = isSet(x, y);
        if (alreadySet) {
            return false;
        }

        var index = holderIndex(x, y);
        var bit = x % 32;
        var mask = 1 << (31 - bit);
        bits[index] |= mask;

        return true;
    }
}

/*
 * Класс заливалки канвы для разных браузеров (заливка вручную)
 */
function CanvasFloodFiller() {
    // Ширина и высота канвы
    var _canvasWidth = -1;
    var _canvasHeight = -1;

    // Заменяемый цвет
    var _srcR = 0;
    var _srcG = 0;
    var _srcB = 0;
    var _srcA = 0;

    // Цвет закраски
    var _dstR = 0;
    var _dstG = 0;
    var _dstB = 0;
    var _dstA = 0;

    var tolerance = 32;

    // Массив пикселей
    var _data = null;

    // Посещённые пиксели на канве
    var _visited = null;

    var dataOffsetByPixel = function (x, y) {
        // Точка: y * ширину_канвы * 4 + (x * 4)
        return (y * _canvasWidth * 4) + (x * 4);
    }

    /*
     * Получить точку из данных
     **/
    var getDot = function (x, y) {
        var startOffset = dataOffsetByPixel(x, y);
        var dr = _data[startOffset];
        var dg = _data[startOffset + 1];
        var db = _data[startOffset + 2];
        var da = _data[startOffset + 3];

        return {r: dr, g: dg, b: db, a: da};
    }

    /**
     * Вычисляет цветовое расстояние между переданным цветом r, g, b, a
     * и заменяемым при заливке цветом
     *
     * @returns {number} Цветовое расстояние
     */
    var computeDistance = function (r, g, b, a) {
        var rDiff = Math.abs(r - _srcR)
        var gDiff = Math.abs(g - _srcG);
        var bDiff = Math.abs(b - _srcB);
        var aDiff = Math.abs(a - _srcA);
        return Math.max(rDiff, gDiff, bDiff, aDiff);
    }

    /*
     * Пиксель по координатам x,y - готовый к заливке?
     **/
    var isReplaceablePixel = function (x, y) {
        // Не посещаем повторно
        if (_visited.isBitSet(x, y)) {
            return false;
        }

        var startOffset = dataOffsetByPixel(x, y);
        var dr = _data[startOffset];
        var dg = _data[startOffset + 1];
        var db = _data[startOffset + 2];
        var da = _data[startOffset + 3];

        if (dr == _srcR && dg == _srcG && db == _srcB && da == _srcA) {
            return true;
        }

        if (tolerance > 0) {
            var distance = computeDistance(dr, dg, db, da);
            return distance <= tolerance;
        }

        return false;
    }

    var replacePixel = function (x, y) {
        if (_visited.compareAndSetBit(x, y)) {
            var offset = dataOffsetByPixel(x, y);
            _data[offset] = _dstR;
            _data[offset + 1] = _dstG;
            _data[offset + 2] = _dstB;
            _data[offset + 3] = _dstA;
        }
    }

    /*
     * Закрашивает все пиксели влево от [x, y], возвращает координату x
     * последнего закрашенного пикселя. Пропускает сам пиксель [x, y].
     **/
    var paintToLeftPixel = function (x, y) {
        var currentX = x - 1;

        while (currentX >= 0 && isReplaceablePixel(currentX, y)) {
            replacePixel(currentX, y);
            currentX--;
        }

        // Мы вылетели за край, либо попали в незаменяемый пиксель, так что
        // последний был на единицу правее
        return currentX + 1;
    }

    /*
     * Закрашивает пиксель [x, y] и все пиксели вправо, возвращает координату x
     * последнего закрашенного пикселя.
     *
     * isReplaceablePixel(x, y) обязан возвращать true!
     **/
    var paintToRightPixel = function (x, y) {
        var currentX = x;

        while (currentX < _canvasWidth && isReplaceablePixel(currentX, y)) {
            replacePixel(currentX, y);
            currentX++;
        }

        // Мы вылетели за край, как и в paintToLeftPixel
        return currentX - 1;
    }

    /**
     * Безусловно закрашивает строку, на которой лежит пиксель [x,y].
     * Не проверяет, подлежит ли этот пиксель замене: проверка
     * isReplaceablePixel(x, y) должна быть проведена заранее.
     *
     * @returns Описание линии в виде объекта с координатами: x1, x2, y.
     */
    var makeLine = function (x, y) {
        var left = paintToLeftPixel(x, y)
        var right = paintToRightPixel(x, y)
        return {x1: left, x2: right, y: y};
    }

    /**
     * Закрашивает строку, на которой лежит пиксель [x,y].
     * Вернёт null, если ничего покрасить не удалось.
     *
     * @returns Описание линии в виде объекта с координатами: x1, x2, y,
     *          либо null
     */
    var tryToMakeLine = function (x, y) {
        if (isReplaceablePixel(x, y)) {
            return makeLine(x, y);
        }

        return null;
    }

    /*
     * Эффективная (строчная) заливка по координатам [x, y]
     **/
    var effectiveFill = function (cx, cy) {
        var lineQueue = new Array();

        // Формируем первую залитую строку в стороны от точки x, y
        lineQueue.push(makeLine(cx, cy));

        while (lineQueue.length > 0) {
            var line = lineQueue.pop();

            // line уже закрашена, и левее-правее искать смысла нет,
            // а вот выше-ниже лежат другие строки.
            // Есть строка выше?
            if (line.y > 0) {
                for (var x = line.x1; x <= line.x2; x++) {
                    var newLine = tryToMakeLine(x, line.y - 1);
                    if (newLine !== null) {
                        lineQueue.push(newLine);
                        x = newLine.x2;
                    }
                }
            }

            // Теперь это же, но на строку вниз
            if (line.y < (_canvasHeight - 1)) {
                for (x = line.x1; x <= line.x2; x++) {
                    newLine = tryToMakeLine(x, line.y + 1);
                    if (newLine !== null) {
                        lineQueue.push(newLine);
                        x = newLine.x2;
                    }
                }
            }

        }   // while (line queue is not empty)
    }

    /*
     * void floodFill(CanvasContext2D canvasContext, int x, int y)
     * Выполняет заливку на канве
     * canvasContext - контекст
     * int x, y - координаты точки заливки
     * color - цвет заливки
     */
    this.floodFill = function (canvasContext, x, y, color) {
        _canvasWidth = canvasContext.canvas.width;
        _canvasHeight = canvasContext.canvas.height;

        // Координаты приводятся к целым пикселям: дробный индекс в
        // _data даёт undefined, из-за чего старый строчный алгоритм
        // считал всю канву "подходящей" и входил в бесконечный цикл.
        // Дополнительно отсекаем клики мимо канвы.
        x = Math.floor(x);
        y = Math.floor(y);

        if (x < 0 || x >= _canvasWidth || y < 0 || y >= _canvasHeight)
            return;

        _dstR = color.r;
        _dstG = color.g;
        _dstB = color.b;
        _dstA = color.a;

        var imageData = canvasContext.getImageData(0, 0, _canvasWidth, _canvasHeight);
        var pixels = imageData.data;
        _data = pixels;
        _visited = new CanvasBitMask(_canvasWidth, _canvasHeight);

        var toReplace = getDot(x, y);
        _srcR = toReplace.r;
        _srcG = toReplace.g;
        _srcB = toReplace.b;
        _srcA = toReplace.a;

        // Всё зависнет, если цвета совпадают
        if (_srcR == _dstR && _srcG == _dstG && _srcB == _dstB && _srcA == _dstA)
            return;

        effectiveFill(x, y);

        canvasContext.putImageData(imageData, 0, 0);
    }
}