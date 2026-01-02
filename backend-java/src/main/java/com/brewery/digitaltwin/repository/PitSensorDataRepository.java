package com.brewery.digitaltwin.repository;

import com.brewery.digitaltwin.entity.PitSensorData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PitSensorDataRepository extends JpaRepository<PitSensorData, Long> {
    
    List<PitSensorData> findByPitIdOrderByRecordedAtDesc(Long pitId);
    
    List<PitSensorData> findTop10ByPitIdOrderByRecordedAtDesc(Long pitId);
    
    List<PitSensorData> findByRecordedAtAfter(LocalDateTime time);
    
    @Query("SELECT p FROM PitSensorData p WHERE p.recordedAt = " +
           "(SELECT MAX(p2.recordedAt) FROM PitSensorData p2 WHERE p2.pitId = p.pitId)")
    List<PitSensorData> findLatestForAllPits();
    
    void deleteByRecordedAtBefore(LocalDateTime time);

    Optional<PitSensorData> findTopByPitIdOrderByRecordedAtDesc(Long pitId);
}
