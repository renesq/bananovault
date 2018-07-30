import { Component, OnInit } from '@angular/core';
import {WalletService} from "../services/wallet.service";

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.css']
})
export class WelcomeComponent implements OnInit {

  donationAccount = `eur_318syypnqcgdouy3p3ekckwmnmmyk5z3dpyq48phzndrmmspyqdqjymoo8hj`;

  wallet = this.walletService.wallet;

  constructor(private walletService: WalletService) { }

  ngOnInit() {
  }

}
