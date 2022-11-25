import { Injectable } from '@nestjs/common';

import dateFormat from 'dateformat';
import { getDBClient } from 'src/utils/db-client';

import { Cart, CartItem } from '../models';

@Injectable()
export class CartService {
  // private userCarts: Record<string, Cart> = {};
  private userCarts = {
    '1': '749b4f71-55c2-404f-b5c7-380ae5c35176',
    '2': 'cb736625-5ee5-4dfa-86c5-e36521139c9f',
    '3': 'fb2a1558-235e-4b83-b77b-fb04088b2daa',
  };

  async findByUserId(userId: string): Promise<Cart> {
    const client = await getDBClient();
    const cartId = this.userCarts[userId];

    if (!cartId) return null;

    const { rows } = await client.query(`
          select carts.id, cart_items.product_id, cart_items.count from carts
          inner join cart_items on carts.id=cart_items.cart_id
          where carts.id='${cartId}';
    `);
    const items: CartItem[] = await Promise.all(rows.map(async ({ product_id, count }) => {
      const { rows } = await client.query(`
          select products.id, products.title, products.description, products.price from products
          where products.id='${product_id}';
      `);
      return {
        count,
        product: rows[0],
      };
    }));

    return {
      id: cartId,
      items,
    };
  }

  async createByUserId(userId: string): Promise<Cart> {
    const client = await getDBClient();
    const now = new Date();
    const formattedDate = dateFormat(now, 'yyyy-mm-dd hh:MM:ss');
    const query = `
        insert into carts (created_at, updated_at) values
        ('${formattedDate}', '${formattedDate}')
        returning id;
    `;
    const { rows } = await client.query(query);

    this.userCarts[ userId ] = rows[0].id;

    return {
      id: rows[0].id,
      items: [],
    };
  }

  async findOrCreateByUserId(userId: string): Promise<Cart> {
    const userCart = await this.findByUserId(userId);

    if (userCart) {
      return userCart;
    }

    return this.createByUserId(userId);
  }

  async updateByUserId(userId: string, { items }: Cart): Promise<Cart> {
    const client = await getDBClient();
    const { id, ...rest } = await this.findOrCreateByUserId(userId);

    const updatedCart = {
      id,
      ...rest,
      items: [ ...items ],
    }

    await Promise.all(items.map(async ({ product, count }) => {
      const query = `
        insert into cart_items (cart_id, product_id, count) values
        ('${id}', '${product.id}', ${count});
      `;
      await client.query(query);
    }));

    return { ...updatedCart };
  }

  async removeByUserId(userId): Promise<void> {
    const client = await getDBClient();

    const cartId = this.userCarts[userId];

    const queryCartItems = `delete from cart_items where cart_items.cart_id='${cartId}';`;
    await client.query(queryCartItems);

    const queryCarts = `delete from carts where carts.id='${cartId}';`;
    await client.query(queryCarts);

    this.userCarts[ userId ] = null;
  }

}
