import { Injectable } from '@angular/core';
import { BoardViewModel } from '../models/board.types';

@Injectable()
export class BoardCacheService {
  clone(view: BoardViewModel | null): BoardViewModel | null {
    return view ? structuredClone(view) : null;
  }
}
