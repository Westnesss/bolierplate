package com.boilerplate.uce.service;

import com.boilerplate.uce.model.Product;
import com.boilerplate.uce.repository.ProductRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ProductService {

    private final ProductRepository repository;

    public ProductService(ProductRepository repository) {
        this.repository = repository;
    }

    public Product create(Product product) {
        return repository.save(product);
    }

    public List<Product> findAll() {
        return repository.findAll();
    }

    public Optional<Product> findById(Long id) {
        return repository.findById(id);
    }

    public Optional<Product> update(Long id, Product data) {
        return repository.findById(id).map(existing -> {
            existing.setName(data.getName());
            existing.setDescription(data.getDescription());
            existing.setPrice(data.getPrice());
            existing.setStock(data.getStock());
            return repository.save(existing);
        });
    }

    public boolean delete(Long id) {
        if (repository.existsById(id)) {
            repository.deleteById(id);
            return true;
        }
        return false;
    }
}