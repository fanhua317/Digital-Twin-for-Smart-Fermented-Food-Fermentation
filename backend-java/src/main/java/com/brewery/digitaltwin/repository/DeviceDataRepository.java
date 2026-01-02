package com.brewery.digitaltwin.repository;

import com.brewery.digitaltwin.entity.DeviceData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface DeviceDataRepository extends JpaRepository<DeviceData, Long> {
    
    List<DeviceData> findByDeviceIdOrderByRecordedAtDesc(Long deviceId);
    
    List<DeviceData> findTop10ByDeviceIdOrderByRecordedAtDesc(Long deviceId);
    
    List<DeviceData> findByRecordedAtAfter(LocalDateTime time);
    
    @Query("SELECT d FROM DeviceData d WHERE d.recordedAt = " +
           "(SELECT MAX(d2.recordedAt) FROM DeviceData d2 WHERE d2.deviceId = d.deviceId)")
    List<DeviceData> findLatestForAllDevices();
    
    @Query("SELECT SUM(d.power) FROM DeviceData d WHERE d.recordedAt > :since")
    Double sumPowerSince(LocalDateTime since);
    
    void deleteByRecordedAtBefore(LocalDateTime time);
}
