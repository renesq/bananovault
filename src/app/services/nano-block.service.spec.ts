import { TestBed, inject } from '@angular/core/testing';

import { NOSBlockService } from './nano-block.service';

describe('NOSBlockService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NOSBlockService]
    });
  });

  it('should be created', inject([NOSBlockService], (service: NOSBlockService) => {
    expect(service).toBeTruthy();
  }));
});
