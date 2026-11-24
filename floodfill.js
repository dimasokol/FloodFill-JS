/**
 * Битовая маска для канвы, хранящая обработанные пиксели
 *
 * @param width ширина канвы
 * @param height высота канвы
 * @constructor Конструктор принимает ширину и высоту канвы
 */
class CanvasBitMask {
    #width;
    #height;
    #intWidth;
    #bits;

    constructor(width, height) {
        this.#width = width;
        this.#height = height;
        this.#intWidth = Math.ceil(width / 32);

        this.#bits = new Array(this.#intWidth * height);
        this.#bits.fill(0);
    }

    #holderIndex(x, y) {
        if (x >= this.#width || y >= this.#height) throw new Error("Out of canvas bounds");
        return (y * this.#intWidth) + Math.floor(x / 32);
    }

    #isSet(x, y) {
        const index = this.#holderIndex(x, y);
        const holder = this.#bits[index];
        const bit = x % 32;
        return ((holder >>> (31 - bit)) & 0x1) > 0;
    }

    isBitSet(x, y) {
        return this.#isSet(x, y);
    }

    compareAndSetBit(x, y) {
        const alreadySet = this.#isSet(x, y);
        if (alreadySet) {
            return false;
        }

        const index = this.#holderIndex(x, y);
        const bit = x % 32;
        const mask = 1 << (31 - bit);
        this.#bits[index] |= mask;

        return true;
    }
}

/*
 * Класс заливалки канвы для разных браузеров (заливка вручную)
 */
class CanvasFloodFiller {
    // Ширина и высота канвы
    #canvasWidth = -1;
    #canvasHeight = -1;

    // Заменяемый цвет
    #srcR = 0;
    #srcG = 0;
    #srcB = 0;
    #srcA = 0;

    // Цвет закраски
    #dstR = 0;
    #dstG = 0;
    #dstB = 0;
    #dstA = 0;

    // Допуск на цветовое расстояние
    #tolerance = 32;

    // Массив пикселей
    #data = null;

    // Посещённые пиксели на канве
    #visited = null;

    #dataOffsetByPixel(x, y) {
        // Точка: y * ширину_канвы * 4 + (x * 4)
        return (y * this.#canvasWidth * 4) + (x * 4);
    }

    /*
     * Получить точку из данных
     **/
    #getDot(x, y) {
        const startOffset = this.#dataOffsetByPixel(x, y);
        const dr = this.#data[startOffset];
        const dg = this.#data[startOffset + 1];
        const db = this.#data[startOffset + 2];
        const da = this.#data[startOffset + 3];

        return {r: dr, g: dg, b: db, a: da};
    }

    /**
     * Вычисляет цветовое расстояние между переданным цветом r, g, b, a
     * и заменяемым при заливке цветом
     *
     * @returns {number} Цветовое расстояние
     */
    #computeDistance(r, g, b, a) {
        const rDiff = Math.abs(r - this.#srcR);
        const gDiff = Math.abs(g - this.#srcG);
        const bDiff = Math.abs(b - this.#srcB);
        const aDiff = Math.abs(a - this.#srcA);
        return Math.max(rDiff, gDiff, bDiff, aDiff);
    }

    /*
     * Пиксель по координатам x,y - готовый к заливке?
     **/
    #isReplaceablePixel(x, y) {
        // Не посещаем повторно
        if (this.#visited.isBitSet(x, y)) {
            return false;
        }

        const startOffset = this.#dataOffsetByPixel(x, y);
        const dr = this.#data[startOffset];
        const dg = this.#data[startOffset + 1];
        const db = this.#data[startOffset + 2];
        const da = this.#data[startOffset + 3];

        if (dr === this.#srcR && dg === this.#srcG && db === this.#srcB && da === this.#srcA) {
            return true;
        }

        if (this.#tolerance > 0) {
            const distance = this.#computeDistance(dr, dg, db, da);
            return distance <= this.#tolerance;
        }

        return false;
    }

    #replacePixel(x, y) {
        if (this.#visited.compareAndSetBit(x, y)) {
            const offset = this.#dataOffsetByPixel(x, y);
            this.#data[offset] = this.#dstR;
            this.#data[offset + 1] = this.#dstG;
            this.#data[offset + 2] = this.#dstB;
            this.#data[offset + 3] = this.#dstA;
        }
    }

    /*
     * Закрашивает все пиксели влево от [x, y], возвращает координату x
     * последнего закрашенного пикселя. Пропускает сам пиксель [x, y].
     **/
    #paintToLeftPixel(x, y) {
        let currentX = x - 1;

        while (currentX >= 0 && this.#isReplaceablePixel(currentX, y)) {
            this.#replacePixel(currentX, y);
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
    #paintToRightPixel(x, y) {
        let currentX = x;

        while (currentX < this.#canvasWidth && this.#isReplaceablePixel(currentX, y)) {
            this.#replacePixel(currentX, y);
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
    #makeLine(x, y) {
        const left = this.#paintToLeftPixel(x, y);
        const right = this.#paintToRightPixel(x, y);
        return {x1: left, x2: right, y: y};
    }

    /**
     * Закрашивает строку, на которой лежит пиксель [x,y].
     * Вернёт null, если ничего покрасить не удалось.
     *
     * @returns Описание линии в виде объекта с координатами: x1, x2, y,
     *          либо null
     */
    #tryToMakeLine(x, y) {
        if (this.#isReplaceablePixel(x, y)) {
            return this.#makeLine(x, y);
        }

        return null;
    }

    /*
     * Эффективная (строчная) заливка по координатам [x, y]
     **/
    #effectiveFill(cx, cy) {
        const lineQueue = [];

        // Формируем первую залитую строку в стороны от точки x, y
        lineQueue.push(this.#makeLine(cx, cy));

        while (lineQueue.length > 0) {
            const line = lineQueue.pop();

            // line уже закрашена, и левее-правее искать смысла нет,
            // а вот выше-ниже лежат другие строки.
            // Есть строка выше?
            if (line.y > 0) {
                for (let x = line.x1; x <= line.x2; x++) {
                    const newLine = this.#tryToMakeLine(x, line.y - 1);
                    if (newLine !== null) {
                        lineQueue.push(newLine);
                        x = newLine.x2;
                    }
                }
            }

            // Теперь это же, но на строку вниз
            if (line.y < (this.#canvasHeight - 1)) {
                for (let x = line.x1; x <= line.x2; x++) {
                    const newLine = this.#tryToMakeLine(x, line.y + 1);
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
    floodFill(canvasContext, x, y, color) {
        this.#canvasWidth = canvasContext.canvas.width;
        this.#canvasHeight = canvasContext.canvas.height;

        // Координаты приводятся к целым пикселям: дробный индекс в
        // _data даёт undefined, из-за чего старый строчный алгоритм
        // считал всю канву "подходящей" и входил в бесконечный цикл.
        // Дополнительно отсекаем клики мимо канвы.
        x = Math.floor(x);
        y = Math.floor(y);

        if (x < 0 || x >= this.#canvasWidth || y < 0 || y >= this.#canvasHeight) {
            return;
        }

        this.#dstR = color.r;
        this.#dstG = color.g;
        this.#dstB = color.b;
        this.#dstA = color.a;

        const imageData = canvasContext.getImageData(0, 0, this.#canvasWidth, this.#canvasHeight);
        const pixels = imageData.data;
        this.#data = pixels;
        this.#visited = new CanvasBitMask(this.#canvasWidth, this.#canvasHeight);

        const toReplace = this.#getDot(x, y);
        this.#srcR = toReplace.r;
        this.#srcG = toReplace.g;
        this.#srcB = toReplace.b;
        this.#srcA = toReplace.a;

        // Всё зависнет, если цвета совпадают и tolerance == 0
        if (this.#srcR === this.#dstR && this.#srcG === this.#dstG && this.#srcB === this.#dstB && this.#srcA === this.#dstA) {
            return;
        }

        this.#effectiveFill(x, y);

        canvasContext.putImageData(imageData, 0, 0);
    }
}
