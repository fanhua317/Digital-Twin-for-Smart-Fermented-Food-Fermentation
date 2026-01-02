package com.brewery.digitaltwin.service;

import com.brewery.digitaltwin.entity.Device;
import com.brewery.digitaltwin.entity.DeviceData;
import com.brewery.digitaltwin.repository.DeviceRepository;
import com.brewery.digitaltwin.repository.DeviceDataRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DeviceService {
    
    private final DeviceRepository deviceRepository;
    private final DeviceDataRepository deviceDataRepository;
    
    public List<Device> getAllDevices() {
        return deviceRepository.findAll();
    }
    
    public Optional<Device> getDeviceById(Long id) {
        return deviceRepository.findById(id);
    }
    
    public List<Device> getDevicesByType(String type) {
        return deviceRepository.findByType(type);
    }
    
    public List<Device> getDevicesByStatus(String status) {
        return deviceRepository.findByStatus(status);
    }
    
    @Transactional
    public Device createDevice(Device device) {
        return deviceRepository.save(device);
    }
    
    @Transactional
    public Optional<Device> updateDevice(Long id, Device deviceData) {
        return deviceRepository.findById(id).map(device -> {
            if (deviceData.getName() != null) device.setName(deviceData.getName());
            if (deviceData.getStatus() != null) device.setStatus(deviceData.getStatus());
            if (deviceData.getLocation() != null) device.setLocation(deviceData.getLocation());
            return deviceRepository.save(device);
        });
    }
    
    public List<DeviceData> getDeviceData(Long deviceId, Integer hours) {
        if (hours != null) {
            return deviceDataRepository.findByDeviceIdAndRecordedAtAfterOrderByRecordedAtDesc(
                    deviceId, java.time.LocalDateTime.now().minusHours(hours));
        }
        return deviceDataRepository.findTop10ByDeviceIdOrderByRecordedAtDesc(deviceId);
    }
    
    public List<DeviceData> getLatestDeviceData() {
        return deviceDataRepository.findLatestForAllDevicesFast();
    }
}
