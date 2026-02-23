import { Component } from '@angular/core';
import { Mp3PlayerComponent } from './mp3-player/mp3-player.component';

@Component({
  selector: 'app-root',
  imports: [Mp3PlayerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
