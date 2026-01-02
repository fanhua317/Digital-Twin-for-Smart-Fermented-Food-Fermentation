package com.brewery.digitaltwin.repository;

import com.brewery.digitaltwin.entity.Pit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface PitRepository extends JpaRepository<Pit, Long> {
    
    Optional<Pit> findByPitNo(String pitNo);
    
    List<Pit> findByZone(String zone);
    
    List<Pit> findByStatus(String status);
    
    @Query("SELECT COUNT(p) FROM Pit p WHERE p.status = :status")
    long countByStatus(String status);
    
    @Query("SELECT p.zone, COUNT(p) FROM Pit p GROUP BY p.zone")
    List<Object[]> countByZone();
}
