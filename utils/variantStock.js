export async function syncProductsStock(connection, productIds = []) {
  const uniqueIds = [...new Set((productIds || []).map(Number).filter(Boolean))];
  if (!uniqueIds.length) return;

  await connection.query(
    `
      UPDATE products p
      LEFT JOIN (
        SELECT product_id, SUM(stock) AS total_stock
        FROM product_variants
        WHERE product_id IN (?)
        GROUP BY product_id
      ) pv ON pv.product_id = p.id
      SET p.stock = COALESCE(pv.total_stock, p.stock)
      WHERE p.id IN (?)
    `,
    [uniqueIds, uniqueIds],
  );
}

export async function deductOrderItemStock(connection, orderId) {
  const [items] = await connection.query(
    "SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?",
    [orderId],
  );

  const variantProductIds = new Set();

  for (const item of items) {
    if (item.variant_id) {
      await connection.query(
        "UPDATE product_variants SET stock = GREATEST(stock - ?, 0) WHERE id = ?",
        [item.quantity, item.variant_id],
      );
      variantProductIds.add(item.product_id);
    } else {
      await connection.query(
        "UPDATE products SET stock = GREATEST(stock - ?, 0) WHERE id = ?",
        [item.quantity, item.product_id],
      );
    }
  }

  await syncProductsStock(connection, [...variantProductIds]);
}

export async function restoreOrderItemStock(connection, orderId) {
  const [items] = await connection.query(
    "SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?",
    [orderId],
  );

  const variantProductIds = new Set();

  for (const item of items) {
    if (item.variant_id) {
      await connection.query(
        "UPDATE product_variants SET stock = stock + ? WHERE id = ?",
        [item.quantity, item.variant_id],
      );
      variantProductIds.add(item.product_id);
    } else {
      await connection.query(
        "UPDATE products SET stock = stock + ? WHERE id = ?",
        [item.quantity, item.product_id],
      );
    }
  }

  await syncProductsStock(connection, [...variantProductIds]);
}
