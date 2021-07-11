"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonFromMap = exports.getTokenNameFromPair = exports.getLastElement = exports.roundTo = exports.calcPriceQuantity = exports.sortOrdersArray = exports.sortOrdersMap = exports.aggregateOrders = exports.updateOrderbookEntry = exports.createOrdersMap = exports.SortOrder = void 0;
var order_class_1 = require("./models/order.class");
var SortOrder;
(function (SortOrder) {
    SortOrder["ASCENDING"] = "ASCENDING";
    SortOrder["DESCENDING"] = "DESCENDING";
    SortOrder["NONE"] = "NONE";
})(SortOrder = exports.SortOrder || (exports.SortOrder = {}));
function createOrdersMap(orderObjs, sort) {
    if (sort === void 0) { sort = SortOrder.ASCENDING; }
    console.log("Creating orders map", orderObjs);
    var ordersMap = new Map();
    orderObjs.forEach(function (orderObj) {
        var _a;
        var tOrder = order_class_1.Order.create(orderObj);
        if (!ordersMap.has(tOrder.price)) {
            ordersMap.set(tOrder.price, [tOrder]);
        }
        else {
            (_a = ordersMap.get(tOrder.price)) === null || _a === void 0 ? void 0 : _a.push(tOrder);
        }
    });
    //   console.log("Unsorted orders map:", ordersMap);
    var sortedMap = sortOrdersMap(ordersMap, sort);
    console.log("Sorted orders map:", sortedMap);
    return sortedMap;
}
exports.createOrdersMap = createOrdersMap;
function updateOrderbookEntry(changeType, newOrder, oldEntry, oldOrder) {
    if (oldOrder === void 0) { oldOrder = null; }
    var newEntry;
    if (changeType == "added") {
        if (oldEntry) {
            newEntry = {
                pair: oldEntry.pair,
                side: oldEntry.side,
                price: oldEntry.price,
                quantity: oldEntry.quantity + newOrder.quantity - newOrder.quantityFulfilled,
                orderCount: oldEntry.orderCount + 1,
            };
        }
        else {
            newEntry = {
                pair: newOrder.pair,
                side: newOrder.side,
                price: newOrder.price,
                quantity: newOrder.quantity - newOrder.quantityFulfilled,
                orderCount: 1,
            };
        }
    }
    else if (changeType == "modified" && oldOrder && oldEntry) {
        newEntry = {
            pair: oldEntry.pair,
            side: oldEntry.side,
            price: oldEntry.price,
            quantity: oldEntry.quantity + oldOrder.quantityFulfilled - newOrder.quantityFulfilled,
            orderCount: oldEntry.orderCount,
        };
    }
    else if (changeType == "removed" && oldEntry) {
        if (oldEntry.orderCount == 1) {
            newEntry = null;
        }
        else {
            newEntry = {
                pair: oldEntry.pair,
                side: oldEntry.side,
                price: oldEntry.price,
                quantity: oldEntry.quantity - (newOrder.quantity - newOrder.quantityFulfilled),
                orderCount: oldEntry.orderCount - 1,
            };
        }
    }
    else {
        console.log("ERROR! Could not update orderbook enrty.");
        newEntry = null;
    }
    return newEntry;
}
exports.updateOrderbookEntry = updateOrderbookEntry;
function aggregateOrders(ordersMap) {
    var aggOrdersArray = [];
    ordersMap.forEach(function (priceOrders, price) {
        if (priceOrders.length > 0) {
            var totalQuantity_1 = 0;
            priceOrders.forEach(function (order) {
                totalQuantity_1 += order.quantity - order.quantityFulfilled;
            });
            var entry = {
                pair: priceOrders[0].pair,
                side: priceOrders[0].side,
                price: price,
                quantity: totalQuantity_1,
                orderCount: priceOrders.length,
            };
            aggOrdersArray.push(entry);
        }
    });
    return aggOrdersArray;
}
exports.aggregateOrders = aggregateOrders;
function sortOrdersMap(ordersMap, sortOrder) {
    if (sortOrder === void 0) { sortOrder = SortOrder.ASCENDING; }
    var newOrdersMap = new Map();
    var orderedKeys = Array.from(ordersMap.keys()).sort(function (a, b) { return a - b; });
    if (sortOrder === SortOrder.DESCENDING) {
        orderedKeys = orderedKeys.reverse();
    }
    orderedKeys.forEach(function (key) {
        var newOrdersList = sortOrdersArray(ordersMap.get(key));
        newOrdersMap.set(key, newOrdersList);
    });
    return newOrdersMap;
}
exports.sortOrdersMap = sortOrdersMap;
function sortOrdersArray(ordersArray, sortOrder, field) {
    if (sortOrder === void 0) { sortOrder = SortOrder.ASCENDING; }
    if (field === void 0) { field = 'dateCreated'; }
    if (!ordersArray) {
        return [];
    }
    else if (sortOrder === SortOrder.NONE) {
        return ordersArray;
    }
    else {
        var sortMultiplier_1 = sortOrder === SortOrder.ASCENDING ? 1 : -1;
        var newOrdersArray = ordersArray.sort(function (a, b) {
            return (a[field] - b[field]) * sortMultiplier_1;
        });
        return newOrdersArray;
    }
}
exports.sortOrdersArray = sortOrdersArray;
function calcPriceQuantity(ordersArray) {
    if (ordersArray) {
        return ordersArray.reduce(function (total, order) {
            return total + order.quantity - order.quantityFulfilled;
        }, 0);
    }
    else
        return 0;
}
exports.calcPriceQuantity = calcPriceQuantity;
function roundTo(digits, n) {
    if (digits === void 0) { digits = 0; }
    var negativeMultiplier = n < 0 ? -1 : 1;
    var multiplier = Math.pow(10, digits) * negativeMultiplier;
    var result = +(Math.round(n * multiplier) / multiplier).toFixed(digits);
    return result;
}
exports.roundTo = roundTo;
function getLastElement(a) {
    if (a && a.length > 0) {
        return a[a.length - 1];
    }
    else {
        return null;
    }
}
exports.getLastElement = getLastElement;
function getTokenNameFromPair(pairCode, tokenNo) {
    if (tokenNo === 'token1') {
        return pairCode.split('-')[0];
    }
    else {
        return pairCode.split('-')[1];
    }
}
exports.getTokenNameFromPair = getTokenNameFromPair;
function JsonFromMap(map) {
    var result = "{";
    var first = true;
    map.forEach(function (value, key) {
        if (!first) {
            result = result + ",";
        }
        else {
            first = false;
        }
        result = result + key + ":" + JSON.stringify(value);
    });
    result = result + "}";
    return result;
}
exports.JsonFromMap = JsonFromMap;
