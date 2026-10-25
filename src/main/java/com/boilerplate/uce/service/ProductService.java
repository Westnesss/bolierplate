package com.boilerplate.uce.service;

import com.boilerplate.uce.model.Producto;
import com.boilerplate.uce.repository.ProductoRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ProductoService {

    private final ProductoRepository repository;

    public ProductoService(ProductoRepository repository) {
        this.repository = repository;
    }

    // CREATE
    public Producto crear(Producto producto) {
        return repository.save(producto);
    }

    // READ (todos)
    public List<Producto> listar() {
        return repository.findAll();
    }

    // READ (uno)
    public Optional<Producto> buscarPorId(Long id) {
        return repository.findById(id);
    }

    // UPDATE
    public Optional<Producto> actualizar(Long id, Producto datos) {
        return repository.findById(id).map(existente -> {
            existente.setNombre(datos.getNombre());
            existente.setDescripcion(datos.getDescripcion());
            existente.setPrecio(datos.getPrecio());
            existente.setStock(datos.getStock());
            return repository.save(existente);
        });
    }

    // DELETE
    public boolean eliminar(Long id) {
        if (repository.existsById(id)) {
            repository.deleteById(id);
            return true;
        }
        return false;
    }
}