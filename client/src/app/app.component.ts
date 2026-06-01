import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { disposeApolloWs } from './core/apollo/create-apollo';
import { ThemeService } from './core/theme/theme.service';
import { ToastContainerComponent } from './core/toast/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent, AsyncPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnDestroy {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);

  logout(): void {
    this.auth.logout({ logoutParams: { returnTo: window.location.origin } });
  }

  ngOnDestroy(): void {
    disposeApolloWs();
  }
}
