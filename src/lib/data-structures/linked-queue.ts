/**
 * LinkedQueue - 链式队列实现
 * 用于FCFS（先进先出）队列，O(1)入队和出队
 */

class QueueNode<T> {
  value: T;
  next: QueueNode<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}

export class LinkedQueue<T> {
  private head: QueueNode<T> | null = null;
  private tail: QueueNode<T> | null = null;
  private count = 0;

  /**
   * 入队 O(1)
   */
  enqueue(item: T): void {
    const node = new QueueNode(item);

    if (this.tail === null) {
      // 空队列
      this.head = node;
      this.tail = node;
    } else {
      // 添加到尾部
      this.tail.next = node;
      this.tail = node;
    }

    this.count++;
  }

  /**
   * 出队 O(1)
   */
  dequeue(): T | undefined {
    if (this.head === null) return undefined;

    const value = this.head.value;
    this.head = this.head.next;

    if (this.head === null) {
      // 队列变空
      this.tail = null;
    }

    this.count--;
    return value;
  }

  /**
   * 查看队首元素但不移除 O(1)
   */
  peek(): T | undefined {
    return this.head?.value;
  }

  /**
   * 队列大小
   */
  size(): number {
    return this.count;
  }

  /**
   * 是否为空
   */
  isEmpty(): boolean {
    return this.count === 0;
  }

  /**
   * 转换为数组（用于调试和可视化）
   */
  toArray(): T[] {
    const result: T[] = [];
    let current = this.head;
    while (current !== null) {
      result.push(current.value);
      current = current.next;
    }
    return result;
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.head = null;
    this.tail = null;
    this.count = 0;
  }
}
