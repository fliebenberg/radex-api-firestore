import { roundTo } from "../utils";
import { ChangeRec, ChangeType } from "../websockets";
import { PairState } from "./pairState.class";
import { Trade } from "./trade.class";

export class TimeSlice {
  constructor(
    public startTime: number = 0,
    public pair: string = "",
    public open: number = 0,
    public close: number = 0,
    public high: number = 0,
    public low: number = 0,
    public token1Volume: number = 0,
    public token2Volume: number = 0,
    public noOfTrades: number = 0,
  ) {}
}

export const SLICE_DURS = ["1m", "5m", "15m", "30m", "1h", "4h", "12h", "1D", "1W", "1M"];

export function updateSlices(pairState: PairState, trade: Trade): {pairState: PairState, changes: ChangeRec[]} {
  let changes: ChangeRec[] = [];
  let changeType: ChangeType;
  let changeChannel: string;
  if (!trade.date) {
      throw Error("Unexpected error: Trade has no date specified. "+ trade.id);
  }
  SLICE_DURS.forEach(sliceDurStr => {
      const changeChannel = "slices" + sliceDurStr;
      const sliceStart = getTimeSliceStart(trade.date, sliceDurStr);
      const durSlices = pairState.slices.get(sliceDurStr);
      if (!durSlices) {
          throw Error("Unexpected error: No duration slice map for duration "+ sliceDurStr);
      }
      let newValue: TimeSlice;
      if (durSlices.has(sliceStart)) {
          changeType = ChangeType.UPDATE;
          newValue = addToSlice(durSlices.get(sliceStart) as TimeSlice, trade);
      } else {
          changeType = ChangeType.ADD;
          newValue = addToSlice(new TimeSlice(sliceStart, trade.pair, trade.price, trade.price, trade.price, trade.price), trade);
      }
      durSlices.set(sliceStart, newValue);
      changes.push({type: changeType, channel: changeChannel, data: newValue});
      pairState.slices.set(sliceDurStr, durSlices);
  })

  // calc slice24h - updated every 5 mins
  changeChannel = "slice24h"
  const sliceStartTime = getTimeSliceStart(trade.date, "24h");
  let newState: TimeSlice;
  const oldState = pairState.slice24h;
  if (oldState) {
    changeType = ChangeType.UPDATE;
  } else {
    changeType = ChangeType.ADD;
  }
  if (oldState && sliceStartTime == oldState.startTime) {
    newState = addToSlice(oldState, trade);
  } else {
    const slicesArray = pairState.slices.get("5m")?.values();
    if (slicesArray) {
      newState = Array.from(slicesArray)
        .filter(slice => slice.startTime >= sliceStartTime)
        .sort((a, b) => a.startTime - b.startTime)
        .reduce((state, slice, index) => {
          if (index = 0) {
            return {...slice, startTime: sliceStartTime}
          } else {
            return {
              ...state,
              close: slice.close,
              high: slice.high > state.high ? slice.high : state.high,
              low: slice.low < state.low ? slice.low : state.low,
              token1Volume: state.token1Volume + slice.token1Volume,
              token2Volume: state.token2Volume + slice.token2Volume,
              noOfTrades: state.noOfTrades + slice.noOfTrades,
            }
          }
        })
    } else {
      const new5mEndSlice = pairState.slices.get("5m")?.get(getTimeSliceStart(trade.date, "5m")) as TimeSlice;
      newState = {...new5mEndSlice as TimeSlice, startTime: sliceStartTime}
    }
  }
  pairState.slice24h = newState;
  changes.push({type: changeType, channel: changeChannel, data: newState});
  return {pairState: pairState, changes: changes};
}

export function addToSlice(oldSlice: TimeSlice, trade: Trade): TimeSlice {
  const newSlice = {
      ...oldSlice,
      close: trade.price,
      high: trade.price > oldSlice.high? trade.price : oldSlice.high,
      low: trade.price < oldSlice.low? trade.price : oldSlice.low,
      token1Volume: oldSlice.token1Volume + trade.quantity,
      token2Volume: oldSlice.token2Volume + roundTo(8, trade.price * trade.quantity),
      noOfTrades: oldSlice.noOfTrades + 1,
  }
  return newSlice;
}

export function getTimeSliceStart(date: number, TSDuration: string): number {
  switch (TSDuration) {
    case "1m": return new Date(date).setUTCSeconds(0,0);
    case "5m": {
      const oldDate = new Date(date);
      const mins = oldDate.getUTCMinutes();
      return new Date(date).setUTCMinutes(mins - (mins % 5),0,0);
    }
    case "15m": {
      const oldDate = new Date(date);
      const mins = oldDate.getUTCMinutes();
      return new Date(date).setUTCMinutes(mins - (mins % 15),0,0);
    }
    case "30m": {
      const oldDate = new Date(date);
      const mins = oldDate.getUTCMinutes();
      return new Date(date).setUTCMinutes(mins - (mins % 30),0,0);
    }
    case "1h": {
      const oldDate = new Date(date);
      const hours = oldDate.getUTCHours();
      return new Date(date).setUTCHours(hours,0,0,0);
    }
    case "4h": {
      const oldDate = new Date(date);
      const hours = oldDate.getUTCHours();
      return new Date(date).setUTCHours(hours - (hours % 4),0,0,0);
    }
    case "12h": {
      const oldDate = new Date(date);
      const hours = oldDate.getUTCHours();
      return new Date(date).setUTCHours(hours - (hours % 12),0,0,0);
    }
    case "1D": {
      return new Date(date).setUTCHours(0,0,0,0);
    }
    case "1W": return startOfWeek(date);
    case "1M": return startOfMonth(date);
    case "24h": { 
      // console.log("Old 24h time:" + new Date(date).toUTCString());
      const oldDate = new Date(date);
      const mins = oldDate.getUTCMinutes();
      const last5m =  new Date(date).setUTCMinutes(mins - (mins % 5),0,0);
      const day = new Date(last5m).getUTCDate();
      const newDate = new Date(last5m).setUTCDate(day-1);
      // console.log("New 24h time:" + new Date(newDate).toUTCString());
      return newDate;
    }
    default: throw Error ("Unexpected error: Unrecognised TimeSlice duration: "+ TSDuration);
  }
}

function startOfWeek(date: number): number {
  // console.log("Calculating start of week for date: "+ new Date(date).toISOString());
  const currentDate = new Date(date);
  const year = currentDate.getUTCFullYear();
  const month = currentDate.getUTCMonth();
  const dayOfMonth = currentDate.getUTCDate();
  const dayOfWeek = currentDate.getUTCDay();
  const SoW = new Date(0).setFullYear(year, month, dayOfMonth-dayOfWeek);
  // console.log("Calculated start of week: "+ new Date(SoW).toISOString());
  return SoW;
}

function startOfMonth(date: number): number {
  // console.log("Calculating start of month for date: "+ new Date(date).toISOString());
  const currentDate = new Date(date);
  const year = currentDate.getUTCFullYear();
  const month = currentDate.getUTCMonth();
  const SoM = new Date(0).setFullYear(year, month, 1);
  // console.log("Calculated start of week: "+ new Date(SoM).toISOString());
  return SoM;
}

