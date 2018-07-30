import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NOSAccountIdComponent } from './nano-account-id.component';

describe('NOSAccountIdComponent', () => {
  let component: NOSAccountIdComponent;
  let fixture: ComponentFixture<NOSAccountIdComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NOSAccountIdComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NOSAccountIdComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
