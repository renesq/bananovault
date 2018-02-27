import { Component, OnInit } from '@angular/core';
import BigNumber from "bignumber.js";
import {AddressBookService} from "../../services/address-book.service";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {WalletService} from "../../services/wallet.service";
import {NotificationService} from "../../services/notification.service";
import {ApiService} from "../../services/api.service";
import {UtilService} from "../../services/util.service";

import * as blake from 'blakejs';
import {WorkPoolService} from "../../services/work-pool.service";
import {AppSettingsService} from "../../services/app-settings.service";
import {ActivatedRoute, ActivatedRouteSnapshot} from "@angular/router";
import {PriceService} from "../../services/price.service";

const nacl = window['nacl'];

@Component({
  selector: 'app-send',
  templateUrl: './send.component.html',
  styleUrls: ['./send.component.css']
})
export class SendComponent implements OnInit {
  nano = 100000000000000000000000; // 10^23 actually microBAN

  activePanel = 'send';

  accounts = this.walletService.wallet.accounts;
  addressBookResults$ = new BehaviorSubject([]);
  showAddressBook = false;
  addressBookMatch = '';

  amounts = [
    { name: 'BAN (10^29 raw)', shortName: 'BAN', value: 'ban' },
    { name: 'mBAN (10^26 raw)', shortName: 'mBAN', value: 'mban' },
    { name: 'uBAN (10^23 raw)', shortName: 'uBAN', value: 'uban' },
  ];
  selectedAmount = this.amounts[0];

  amount = null;
  amountRaw = new BigNumber(0);
  amountFiat: number = 0;
  rawAmount: BigNumber = new BigNumber(0);
  fromAccount: any = {};
  fromAccountID: any = '';
  fromAddressBook = '';
  toAccount: any = false;
  toAccountID: string = '';
  toAddressBook = '';
  toAccountStatus = null;
  confirmingTransaction: boolean = false;

  constructor(
    private router: ActivatedRoute,
    private walletService: WalletService,
    private addressBookService: AddressBookService,
    private notificationService: NotificationService,
    private nodeApi: ApiService,
    public price: PriceService,
    private workPool: WorkPoolService,
    public settings: AppSettingsService,
    private util: UtilService) { }

  async ngOnInit() {
    const params = this.router.snapshot.queryParams;
    if (params && params.amount) {
      this.amount = params.amount;
    }
    if (params && params.to) {
      this.toAccountID = params.to;
      this.validateDestination();
    }

    await this.addressBookService.loadAddressBook();
    this.fromAccountID = this.accounts[0].id;
  }

  searchAddressBook() {
    this.showAddressBook = true;
    const search = this.toAccountID || '';
    const addressBook = this.addressBookService.addressBook;

    const matches = addressBook
      .filter(a => a.name.toLowerCase().indexOf(search.toLowerCase()) !== -1)
      .slice(0, 5);

    this.addressBookResults$.next(matches);
  }

  selectBookEntry(account) {
    this.showAddressBook = false;
    this.toAccountID = account;
    this.searchAddressBook();
    this.validateDestination();
  }

  async validateDestination() {
    // The timeout is used to solve a bug where the results get hidden too fast and the click is never registered
    setTimeout(() => this.showAddressBook = false, 400);

    // Remove spaces from the account id
    this.toAccountID = this.toAccountID.replace(/ /g, '');

    this.addressBookMatch = this.addressBookService.getAccountName(this.toAccountID);

    // const accountInfo = await this.walletService.walletApi.accountInfo(this.toAccountID);
    const accountInfo = await this.nodeApi.accountInfo(this.toAccountID);
    if (accountInfo.error) {
      if (accountInfo.error == 'Account not found') {
        this.toAccountStatus = 1;
      } else {
        this.toAccountStatus = 0;
      }
    }
    if (accountInfo && accountInfo.frontier) {
      this.toAccountStatus = 2;
    }
  }

  async sendTransaction() {
    const isValid = await this.nodeApi.validateAccountNumber(this.toAccountID);
    if (!isValid || isValid.valid == '0') return this.notificationService.sendWarning(`To account address is not valid`);
    if (!this.fromAccountID || !this.toAccountID) return this.notificationService.sendWarning(`From and to account are required`);

    const from = await this.nodeApi.accountInfo(this.fromAccountID);
    const to = await this.nodeApi.accountInfo(this.toAccountID);
    if (!from) return this.notificationService.sendError(`From account not found`);
    if (this.fromAccountID == this.toAccountID) return this.notificationService.sendWarning(`From and to account cannot be the same`);

    from.balanceBN = new BigNumber(from.balance || 0);
    to.balanceBN = new BigNumber(to.balance || 0);

    this.fromAccount = from;
    this.toAccount = to;

    const rawAmount = this.getAmountBaseValue(this.amount || 0);
    this.rawAmount = rawAmount.plus(this.amountRaw);

    const nanoAmount = this.rawAmount.div(this.nano);

    if (this.amount < 0 || rawAmount.lessThan(0)) return this.notificationService.sendWarning(`Amount is invalid`);
    if (nanoAmount.lessThan(1)) return this.notificationService.sendWarning(`Transactions for less than 1 nano will be ignored by the node.  Send raw amounts with at least 1 nano.`);
    if (from.balanceBN.minus(rawAmount).lessThan(0)) return this.notificationService.sendError(`From account does not have enough XRB`);

    // Determine fiat value of the amount
    this.amountFiat = this.util.nano.rawToBan(rawAmount).times(this.price.price.lastPrice).toNumber();

    // Start precopmuting the work...
    this.fromAddressBook = this.addressBookService.getAccountName(this.fromAccountID);
    this.toAddressBook = this.addressBookService.getAccountName(this.toAccountID);
    this.workPool.addToPool(this.fromAccount.frontier);

    this.activePanel = 'confirm';
  }

  async confirmTransaction() {
    const walletAccount = this.walletService.wallet.accounts.find(a => a.id == this.fromAccountID);
    if (!walletAccount) throw new Error(`Unable to find sending account in wallet`);
    if (this.walletService.walletIsLocked()) return this.notificationService.sendWarning(`Wallet must be unlocked`);

    this.confirmingTransaction = true;

    const remaining = new BigNumber(this.fromAccount.balance).minus(this.rawAmount);

    let remainingNew = remaining.toString(16);
    while (remainingNew.length < 32) {
      remainingNew = '0' + remainingNew;
    }

    const context = blake.blake2bInit(32, null);
    blake.blake2bUpdate(context, this.util.hex.toUint8(this.fromAccount.frontier));
    blake.blake2bUpdate(context, this.util.hex.toUint8(this.util.account.getAccountPublicKey(this.toAccountID)));
    blake.blake2bUpdate(context, this.util.hex.toUint8(remainingNew));
    const hashBytes = blake.blake2bFinal(context);

    // Sign the hash bytes with the account priv key bytes
    const signed = nacl.sign.detached(hashBytes, walletAccount.keyPair.secretKey);
    const signature = this.util.hex.fromUint8(signed);

    // Now we just need work...
    const blockData = {
      type: 'send',
      previous: this.fromAccount.frontier,
      destination: this.toAccountID,
      balance: remainingNew,
      work: null,
      signature: signature,
    };

    const response = await this.workPool.getWork(this.fromAccount.frontier);

    blockData.work = response.work;

    // Send to process?
    const processResponse = await this.nodeApi.process(blockData);
    if (processResponse && processResponse.hash) {
      walletAccount.frontier = processResponse.hash;
      this.notificationService.sendSuccess(`Successfully sent ${this.amount} ${this.selectedAmount.shortName}!`);
      this.workPool.addToPool(processResponse.hash); // Add new hash to work pool

      this.activePanel = 'send';
      this.amount = null;
      this.resetRaw();
      this.toAccountID = '';
      this.toAccountStatus = null;
      this.fromAddressBook = '';
      this.toAddressBook = '';
      this.addressBookMatch = '';
    } else {
      this.notificationService.sendError(`There was an error sending your transaction: ${processResponse.message}`)
    }
    this.confirmingTransaction = false;

    await this.walletService.reloadBalances();
  }

  setMaxAmount() {
    const walletAccount = this.walletService.wallet.accounts.find(a => a.id === this.fromAccountID);
    if (!walletAccount) return;

    this.amountRaw = walletAccount.balanceRaw;

    const nanoVal = this.util.nano.rawTouBan(walletAccount.balance).floor();
    const maxAmount = this.getAmountValueFromBase(this.util.nano.ubanToRaw(nanoVal));
    this.amount = maxAmount.toNumber();
  }

  resetRaw() {
    this.amountRaw = new BigNumber(0);
  }

  getAmountBaseValue(value) {

    switch (this.selectedAmount.value) {
      default:
      case 'uban': return this.util.nano.ubanToRaw(value);
      case 'mban': return this.util.nano.mbanToRaw(value);
      case 'ban': return this.util.nano.banToRaw(value);
    }
  }

  getAmountValueFromBase(value) {
    switch (this.selectedAmount.value) {
      default:
      case 'uban': return this.util.nano.rawTouBan(value);
      case 'mban': return this.util.nano.rawTomBan(value);
      case 'ban': return this.util.nano.rawToBan(value);
    }
  }

}
