package com.brewery.digitaltwin.repository;

import com.brewery.digitaltwin.entity.PitSensorData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PitSensorDataRepository extends JpaRepository<PitSensorData, Long> {
    
    List<PitSensorData> findByPitIdOrderByRecordedAtDesc(Long pitId);
    
    List<PitSensorData> findTop10ByPitIdOrderByRecordedAtDesc(Long pitId);

    List<PitSensorData> findByPitIdAndRecordedAtAfterOrderByRecordedAtDesc(Long pitId, LocalDateTime time);
    
    List<PitSensorData> findByRecordedAtAfter(LocalDateTime time);
    
    @Query("SELECT p FROM PitSensorData p WHERE p.recordedAt = " +
           "(SELECT MAX(p2.recordedAt) FROM PitSensorData p2 WHERE p2.pitId = p.pitId)")
    List<PitSensorData> findLatestForAllPits();

    @Query(value = "SELECT psd.* FROM pit_sensor_data psd " +
            "JOIN (SELECT pit_id, MAX(recorded_at) AS max_time " +
            "FROM pit_sensor_data GROUP BY pit_id) latest " +
            "ON psd.pit_id = latest.pit_id AND psd.recorded_at = latest.max_time",
            nativeQuery = true)
    List<PitSensorData> findLatestForAllPitsFast();
    
    void deleteByRecordedAtBefore(LocalDateTime time);
}
