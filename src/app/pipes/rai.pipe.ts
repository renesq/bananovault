import { Pipe, PipeTransform } from '@angular/core';
import {AppSettingsService} from "../services/app-settings.service";

@Pipe({
  name: 'rai'
})
export class RaiPipe implements PipeTransform {
  precision = 6;

  ban = 100000000000000000000000000000;
  mban = 100000000000000000000000000;
  rai  = 1000000000000000000000000;

  transform(value: any, args?: any): any {
    const opts = args.split(',');
    let denomination = opts[0] || 'ban';
    const hideText = opts[1] || false;

    switch (denomination.toLowerCase()) {
      default:
      case 'xrb': return `${(value / this.ban).toFixed(6)}${!hideText ? ' BAN': ''}`;  //this doesn't make much sense to me in the original nanovault because it's the same unit as the next one
      case 'ban':
        const newVal = value / this.ban < 0.000001 ? 0 : value / this.ban; // New more precise toFixed function, but bugs on huge raw numbers
        return `${this.toFixed(newVal, this.precision)}${!hideText ? ' BAN': ''}`;
      case 'mban': return `${(value / this.mban).toFixed(3)}${!hideText ? ' mBAN': ''}`;
      case 'uban': return `${(value / this.uban).toFixed(0)}${!hideText ? ' uBAN': ''}`;
      case 'raw': return `${value}${!hideText ? ' raw': ''}`;
      case 'dynamic':
        const rai = (value / this.uban);
        if (rai >= 1000000) {
          return `${(value / this.ban).toFixed(this.precision)}${!hideText ? ' BAN': ''}`;
        } else if (rai >= 1000) {
          return `${(value / this.mban).toFixed(this.precision)}${!hideText ? ' mBAN': ''}`;
        } else if (rai >= 0.00001) {
          return `${(value / this.uban).toFixed(this.precision)}${!hideText ? ' uBAN': ''}`;
        } else if (rai === 0) {
          return `${value}${!hideText ? ' BAN': ''}`;
        } else {
          return `${value}${!hideText ? ' raw': ''}`;
        }
    }
  }

  toFixed(num, fixed) {
    if (isNaN(num)) return 0;
    var re = new RegExp('^-?\\d+(?:\.\\d{0,' + (fixed || -1) + '})?');
    return num.toString().match(re)[0];
  }

}
