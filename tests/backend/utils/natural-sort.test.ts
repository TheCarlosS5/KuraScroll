import { describe, it, expect } from 'vitest';
import { naturalSort } from '../../../src/backend/utils/natural-sort';

describe('naturalSort', () => {
  it('sorts numeric page filenames in natural order', () => {
    const input = ['page_10.jpg', 'page_1.jpg', 'page_2.jpg', 'page_20.jpg', 'page_3.jpg'];
    const output = naturalSort(input);
    expect(output).toEqual(['page_1.jpg', 'page_2.jpg', 'page_3.jpg', 'page_10.jpg', 'page_20.jpg']);
  });

  it('handles padded and unpadded mixed numbers correctly', () => {
    const input = ['01.png', '100.png', '02.png', '10.png', '003.png'];
    const output = naturalSort(input);
    expect(output).toEqual(['01.png', '02.png', '003.png', '10.png', '100.png']);
  });
});
