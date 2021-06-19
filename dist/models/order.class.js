"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Order = exports.OrderStatus = exports.OrderType = exports.OrderSide = void 0;
var OrderSide;
(function (OrderSide) {
    OrderSide["EMPTY"] = "";
    OrderSide["BUY"] = "BUY";
    OrderSide["SELL"] = "SELL";
})(OrderSide = exports.OrderSide || (exports.OrderSide = {}));
var OrderType;
(function (OrderType) {
    OrderType["EMPTY"] = "";
    OrderType["MARKET"] = "MARKET";
    OrderType["LIMIT"] = "LIMIT";
    OrderType["LIMITONLY"] = "LIMIT-ONLY";
})(OrderType = exports.OrderType || (exports.OrderType = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["EMPTY"] = "";
    OrderStatus["SUBMITTING"] = "SUBMITTING";
    OrderStatus["PENDING"] = "PENDING";
    OrderStatus["COMPLETED"] = "COMPLETED";
    OrderStatus["CANCELLED"] = "CANCELLED";
})(OrderStatus = exports.OrderStatus || (exports.OrderStatus = {}));
var Order = /** @class */ (function () {
    function Order(id, owner, pair, token1, token2, dateCreated, dateCompleted, side, type, price, quantity, value, quantityFulfilled, valueFulfilled, quantitySpecified, status) {
        if (id === void 0) { id = ''; }
        if (owner === void 0) { owner = ''; }
        if (pair === void 0) { pair = ''; }
        if (token1 === void 0) { token1 = ''; }
        if (token2 === void 0) { token2 = ''; }
        if (dateCreated === void 0) { dateCreated = 0; }
        if (dateCompleted === void 0) { dateCompleted = 0; }
        if (side === void 0) { side = OrderSide.EMPTY; }
        if (type === void 0) { type = OrderType.EMPTY; }
        if (price === void 0) { price = 0; }
        if (quantity === void 0) { quantity = 0; }
        if (value === void 0) { value = 0; }
        if (quantityFulfilled === void 0) { quantityFulfilled = 0; }
        if (valueFulfilled === void 0) { valueFulfilled = 0; }
        if (quantitySpecified === void 0) { quantitySpecified = true; }
        if (status === void 0) { status = OrderStatus.EMPTY; }
        this.id = id;
        this.owner = owner;
        this.pair = pair;
        this.token1 = token1;
        this.token2 = token2;
        this.dateCreated = dateCreated;
        this.dateCompleted = dateCompleted;
        this.side = side;
        this.type = type;
        this.price = price;
        this.quantity = quantity;
        this.value = value;
        this.quantityFulfilled = quantityFulfilled;
        this.valueFulfilled = valueFulfilled;
        this.quantitySpecified = quantitySpecified;
        this.status = status;
    }
    Order.create = function (orderObj) {
        // console.log("Creating new order with orderObj: ", orderObj);
        var newOrder = new Order();
        // console.log("Empty new order:", newOrder);
        Object.keys(newOrder).forEach(function (field) {
            if (orderObj[field]) {
                // @ts-ignore
                newOrder[field] = orderObj[field];
            }
            else if (field === 'quantitySpecified' && orderObj[field] !== undefined) {
                newOrder[field] = orderObj[field];
            }
            else if (Order.requiredFields.includes(field) ||
                ((field === 'price' || field === 'quantity') && orderObj.type !== OrderType.MARKET)) {
                throw new Error(field + ' is a required field to create an order');
            }
        });
        if (newOrder.quantitySpecified === true) {
            if (!newOrder.quantity) {
                throw new Error('quantity must be specified to create this order');
            }
            if (!newOrder.value && newOrder.type !== OrderType.MARKET) {
                newOrder.value = newOrder.price * newOrder.quantity;
            }
        }
        if (newOrder.quantitySpecified === false) {
            if (!newOrder.value) {
                throw new Error('value must be specified to create this order');
            }
        }
        if (newOrder.id && newOrder.id.search('_') === -1) {
            newOrder.id = newOrder.pair + '_' + newOrder.id;
        }
        // console.log("Finished creating new order:", newOrder);
        return newOrder;
    };
    Order.requiredFields = ['owner', 'pair', 'token1', 'token2', 'side', 'type'];
    return Order;
}());
exports.Order = Order;
