import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { BoardFacade } from '../../data-access/board.facade';
import { BoardHeaderComponent } from '../../components/board-header/board-header.component';
import { BoardCanvasComponent } from '../../components/board-canvas/board-canvas.component';
import { CardDetailModalComponent } from '../../components/card-detail-modal/card-detail-modal.component';

@Component({
  selector: 'app-board-page',
  standalone: true,
  imports: [BoardHeaderComponent, BoardCanvasComponent, CardDetailModalComponent],
  providers: [BoardFacade],
  templateUrl: './board-page.component.html',
  styleUrl: './board-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardPageComponent implements OnInit {
  readonly facade = inject(BoardFacade);

  ngOnInit(): void {
    this.facade.init();
  }
}
