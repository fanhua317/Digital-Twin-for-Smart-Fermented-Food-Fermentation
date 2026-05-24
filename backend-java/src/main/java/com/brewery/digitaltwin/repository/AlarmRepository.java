package com.brewery.digitaltwin.repository;

import com.brewery.digitaltwin.entity.Alarm;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AlarmRepository extends JpaRepository<Alarm, Long> {
    
    List<Alarm> findByStatus(String status);
    
    List<Alarm> findByLevel(String level);

    List<Alarm> findByLevelAndStatus(String level, String status);
    
    Page<Alarm> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);
    
    List<Alarm> findTop20ByOrderByCreatedAtDesc();
    
    @Query("SELECT COUNT(a) FROM Alarm a WHERE a.status = :status")
    long countByStatus(String status);
    
    @Query("SELECT a.level, COUNT(a) FROM Alarm a WHERE a.status = 'active' GROUP BY a.level")
    List<Object[]> countActiveByLevel();
    
    List<Alarm> findByCreatedAtAfter(LocalDateTime time);
}
