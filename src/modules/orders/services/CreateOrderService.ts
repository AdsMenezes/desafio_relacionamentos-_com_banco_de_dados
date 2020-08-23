import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const checkCustomerExists = await this.customersRepository.findById(customer_id);

    if(!checkCustomerExists) {
      throw new AppError('Customer not exists.');
    }

    const checkProductsExists = await this.productsRepository.findAllById(products);

    if(!checkProductsExists.length) {
      throw new AppError('Products not exists.');
    }

    const existentProductsIds = checkProductsExists.map(product => product.id);

    const checkInexistentProducts = products.filter(
      product => !existentProductsIds.includes(product.id)
    );

    if(checkInexistentProducts.length) {
      throw new AppError('Product not exists.');
    }

    const findProductsWiithNoQuantityAvailable = products.filter(
      product =>
        checkProductsExists.filter(p => p.id === product.id)[0].quantity <
        product.quantity
    );

    if(findProductsWiithNoQuantityAvailable.length) {
      throw new AppError('Product quantity invalid.');
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: checkProductsExists.filter(p => p.id === product.id)[0].price
    }))

    const order = await this.ordersRepository.create({
      customer: checkCustomerExists,
      products: serializedProducts
    })

    const orderedProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        checkProductsExists.filter(p => p.id === product.id)[0].quantity -
        product.quantity
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
