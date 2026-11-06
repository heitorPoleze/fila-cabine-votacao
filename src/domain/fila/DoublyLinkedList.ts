import type { IComparable } from "./IComparable";

class DoublyNode<T extends IComparable> {
    public element: T;
    public next: DoublyNode<T> | null;
    public prev: DoublyNode<T> | null;

    constructor(element: T, next: DoublyNode<T>|null = null, prev: DoublyNode<T> | null = null) {
        this.element = element;
        this.next = next;
        this.prev = prev;
    }
}

export class DoublyLinkedList<T extends IComparable> {
    private _length: number;
    private _head: DoublyNode<T> | null;
    private _tail: DoublyNode<T> | null;

    constructor(element?: T) {
        if (element == undefined) {
            this._length = 0;
            this._head = null;
            this._tail = null;
        } else {
            this._length = 1;
            this._head = new DoublyNode(element);
            this._tail = this._head;
        }
    }

    public get length(): number {
        return this._length;
    }
    
    public push(element: T) {
        const newNode = new DoublyNode(element);

        if (this._head == null) { //indica que a lista está vazia
            this._head = newNode;
        } else {
            this._tail!.next = newNode;
            newNode.prev = this._tail;
        }
        this._tail = newNode;
        this._length++;
    }

    public unshift(element: T) {
        const newNode = new DoublyNode(element, this._head);

        if (this._head == null) { //indica que a lista está vazia
            this._tail = newNode;
        } else {
            this._head.prev = newNode;
        }
        this._head = newNode;
        this._length++;
    }

    public pop(): T | undefined {
        if (this._length == 0) {
            return undefined;
        } else {
            let elementAux: T = this._tail!.element;
            this._tail = this._tail!.prev;
            if (this._tail == null) {//indica que a lista só tinha um elemento
                this._head = null;
            } else {
                this._tail.next = null;
            }
            this._length--;
            return elementAux;
        }
    }

    public shift(): T | undefined {
        if (this._length == 0) {
            return undefined;
        } else {
            let elementAux: T = this._head!.element;
            this._head = this._head!.next;
            if (this._length == 1) {
                this._tail = null;
            } else {
                this._head!.prev = null;
            }
            this._length--;
            return elementAux;
        }
    }

    private getNodeAt(index: number): DoublyNode<T> | null {
        let noAux: DoublyNode<T> | null = null;
        if (index >= 0 && index < this._length) {
            if (index < this._length / 2) {
                noAux = this._head;
                for (let i = 0; i < index; i++) {
                    noAux = noAux!.next as DoublyNode<T>;
                }
            } else {
                noAux = this._tail;
                for (let i = this._length - 1; i > index; i--) {
                    noAux = noAux!.prev;
                }
            }
        }
        return noAux;
    }

    public getElementAt(index: number): T | undefined {
        let noAux: DoublyNode<T> | null = this.getNodeAt(index);
        if (noAux != null) {
            return noAux.element;
        }
        return undefined;
    }

    public insert(element: T, index: number): boolean {
        if (index >= 0 && index <= this._length) {
            if (index == 0) {
                this.unshift(element);
            } else if (index == this._length) {
                this.push(element);
            } else {
                const nodeIndex: DoublyNode<T> | null = this.getNodeAt(index);
                let newNode: DoublyNode<T> = new DoublyNode(element, nodeIndex, nodeIndex!.prev);
                nodeIndex!.prev!.next = newNode;
                nodeIndex!.prev = newNode;
                this._length++;
            }
            return true;
        }
        return false;
    }

    public removeAt(index: number): T | undefined {
        if (index >= 0 && index < this._length) {
            let current: DoublyNode<T> | null = this._head;
            if (index === 0) {
                // Para remover o primeiro elemento, precisa atualizar this._head para o próximo nó
                this._head = current!.next;
                if (this._length === 1) {
                    /* Se a lista tiver apenas um elemento, precisa atualizar this._tail para null.
                       Neste caso, this._head também estará null.
                    */
                    this._tail = null;
                } else {
                    /* Neste caso, haverá pelo menos um elemento na lista, 
                       então é necessário atualizar o prev do novo this._head para null
                    */
                   this._head!.prev = null;
                }
            } else {
                current = this.getNodeAt(index);
                current!.prev!.next = current!.next;
                if (index === this._length - 1) { //ou current == this._tail
                    this._tail = current!.prev;//ou this._tail = this._tail.prev;
                } else {
                    current!.next!.prev = current!.prev;
                }
            }
            this._length--;
            return current!.element;
        }
        return undefined;
    }

    public findIndex(searchedElement: T): number {
        let current: DoublyNode<T> | null = this._head;
        let index: number = 0;

        while (current != null && !searchedElement.equals(current.element)) {
            current = current.next;
            index++;
        }
        if (current != null) {
            return index;
        }
        return -1;
    }

    public remove(searchedElement: T): T | undefined {
        let index = this.findIndex(searchedElement);
        if (index > -1) {
            return this.removeAt(index);
        }
        return undefined;
    }

    public clear() {
        this._head = null;
        this._tail = null;
        this._length = 0;
    }

    public sort() {
        if(this._length > 1) {
            let sorted: boolean = false;
            while (!sorted) {
                sorted = true;
                let currentNode: DoublyNode<T> | null = this._head;
                while (currentNode!.next != null) {
                    if (currentNode!.element.compareTo(currentNode!.next.element) > 0) {
                        let elementAux: T = currentNode!.element;
                        currentNode!.element = currentNode!.next.element;
                        currentNode!.next.element = elementAux;
                        sorted = false;
                    }
                    currentNode = currentNode!.next;
                }
            }
        }
    }

    public reverse() {
        if (this._length > 1) {
            let currentNode: DoublyNode<T> | null = this._head;
            this._head = this._tail;
            this._tail = currentNode;
            while (currentNode != null) {
                let previousNode: DoublyNode<T> | null = currentNode.prev;
                currentNode.prev = currentNode.next;
                currentNode.next = previousNode;
                currentNode = currentNode.prev;
            }
        }
    }

    public isEmpty(): boolean {
        return this._length === 0;
    }


    public toString() {
        if (this._head == null) {
            return "";
        }
        let objString = `${this._head.element}`; //primeiro elemento
        let current = this._head.next;
        for (let i = 1; i < this._length; i++) {
            objString += `\n${current!.element}`; //elementos subsequentes
            current = current!.next;
        }
        return objString;
    }
}
