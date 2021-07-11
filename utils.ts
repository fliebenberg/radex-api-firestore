import { Order, OrderSide, AggregateOrderEntry } from './models/order.class';

export enum SortOrder {
  ASCENDING = 'ASCENDING',
  DESCENDING = 'DESCENDING',
  NONE = 'NONE',
}

export function createOrdersMap(orderObjs: any[], sort: SortOrder = SortOrder.ASCENDING): Map<number, Order[]> {
  console.log("Creating orders map", orderObjs);
  const ordersMap = new Map<number, Order[]>();
  orderObjs.forEach((orderObj: any) => {
    const tOrder = Order.create(orderObj);
    if (!ordersMap.has(tOrder.price)) {
      ordersMap.set(tOrder.price, [tOrder]);
    } else {
      ordersMap.get(tOrder.price)?.push(tOrder);
    }
  });
//   console.log("Unsorted orders map:", ordersMap);
  const sortedMap = sortOrdersMap(ordersMap, sort);
  console.log("Sorted orders map:", sortedMap);
  return sortedMap;
}

export function updateOrderbookEntry(
  changeType: string, newOrder: Order, oldEntry: AggregateOrderEntry | undefined, oldOrder: Order | null = null
): AggregateOrderEntry | null {
  let newEntry: AggregateOrderEntry | null;
  if (changeType == "added") {
    if (oldEntry) {
      newEntry = {
        pair: oldEntry.pair,
        side: oldEntry.side,
        price: oldEntry.price,
        quantity: oldEntry.quantity + newOrder.quantity - newOrder.quantityFulfilled,
        orderCount: oldEntry.orderCount + 1,
      };
    } else {
      newEntry = {
        pair: newOrder.pair,
        side: newOrder.side,
        price: newOrder.price,
        quantity: newOrder.quantity - newOrder.quantityFulfilled,
        orderCount: 1,
      }
    }
  } else if (changeType == "modified" && oldOrder && oldEntry) {
    newEntry =  {
      pair: oldEntry.pair,
      side: oldEntry.side,
      price: oldEntry.price,
      quantity: oldEntry.quantity + oldOrder.quantityFulfilled - newOrder.quantityFulfilled,
      orderCount: oldEntry.orderCount,
    }
  } else if (changeType == "removed" && oldEntry) {
    if (oldEntry.orderCount == 1) {
      newEntry = null;
    } else {
      newEntry = {
        pair: oldEntry.pair,
        side: oldEntry.side,
        price: oldEntry.price,
        quantity: oldEntry.quantity - (newOrder.quantity - newOrder.quantityFulfilled),
        orderCount: oldEntry.orderCount -1,
      }
    }
  } else {
    console.log("ERROR! Could not update orderbook enrty.");
    newEntry = null;
  }
  return newEntry;
}

export function aggregateOrders(ordersMap: Map<number, Order[]>): AggregateOrderEntry[] {
    const aggOrdersArray: AggregateOrderEntry[] = [];
    ordersMap.forEach((priceOrders: Order[], price: number) => {
      if (priceOrders.length > 0) {
        let totalQuantity = 0;
        priceOrders.forEach((order: Order) => {
          totalQuantity += order.quantity - order.quantityFulfilled;
        });
        const entry = {
          pair: priceOrders[0].pair,
          side: priceOrders[0].side,
          price: price,
          quantity: totalQuantity,
          orderCount: priceOrders.length,
        };
        aggOrdersArray.push(entry);
      }
    });
    return aggOrdersArray;
  }
  

export function sortOrdersMap(
  ordersMap: Map<number, Order[]>,
  sortOrder: SortOrder = SortOrder.ASCENDING,
): Map<number, Order[]> {
  const newOrdersMap = new Map<number, Order[]>();
  let orderedKeys = Array.from(ordersMap.keys()).sort((a, b) => a - b);
  if (sortOrder === SortOrder.DESCENDING) {
    orderedKeys = orderedKeys.reverse();
  }
  orderedKeys.forEach((key) => {
    const newOrdersList = sortOrdersArray(ordersMap.get(key));
    newOrdersMap.set(key, newOrdersList);
  });
  return newOrdersMap;
}

export function sortOrdersArray(
  ordersArray: Order[] | undefined,
  sortOrder: SortOrder = SortOrder.ASCENDING,
  field: string = 'dateCreated',
): Order[] {
  if (!ordersArray) {
    return [];
  } else if (sortOrder === SortOrder.NONE) {
    return ordersArray;
  } else {
    const sortMultiplier = sortOrder === SortOrder.ASCENDING ? 1 : -1;
    const newOrdersArray = ordersArray.sort((a: any, b: any) => {
      return (a[field] - b[field]) * sortMultiplier;
    });
    return newOrdersArray;
  }
}

export function calcPriceQuantity(ordersArray: Order[] | undefined): number {
  if (ordersArray) {
    return ordersArray.reduce((total, order) => {
      return total + order.quantity - order.quantityFulfilled;
    }, 0);
  } else return 0;
}

export function roundTo(digits: number = 0, n: number): number {
  const negativeMultiplier = n < 0 ? -1 : 1;
  const multiplier = Math.pow(10, digits) * negativeMultiplier;
  const result = +(Math.round(n * multiplier) / multiplier).toFixed(digits);
  return result;
}

export function getLastElement<T>(a: T[] | undefined): T | null {
  if (a && a.length > 0) {
    return a[a.length - 1];
  } else {
    return null;
  }
}





export function getTokenNameFromPair(pairCode: string, tokenNo: 'token1' | 'token2'): string {
  if (tokenNo === 'token1') {
    return pairCode.split('-')[0];
  } else {
    return pairCode.split('-')[1];
  }
}

export function JsonFromMap(map: Map<any, any>): string {
    let result = "{";
    let first = true;
    map.forEach((value, key) => {
        if (!first) {
            result = result + ",";
        } else {
            first = false;
        }
        result = result + key + ":" + JSON.stringify(value);
    })
    result = result + "}"
    return result;
}