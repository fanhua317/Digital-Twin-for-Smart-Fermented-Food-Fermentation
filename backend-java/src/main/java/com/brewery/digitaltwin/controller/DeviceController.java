package com.brewery.digitaltwin.controller;

import com.brewery.digitaltwin.dto.ApiResponse;
import com.brewery.digitaltwin.entity.Device;
import com.brewery.digitaltwin.entity.DeviceData;
import com.brewery.digitaltwin.service.DeviceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/devices")
@RequiredArgsConstructor
public class DeviceController {
    
    private final DeviceService deviceService;
    
    @GetMapping
    public ApiResponse<List<Device>> getAllDevices(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status) {
        List<Device> devices;
        if (type != null) {
            devices = deviceService.getDevicesByType(type);
        } else if (status != null) {
            devices = deviceService.getDevicesByStatus(status);
        } else {
            devices = deviceService.getAllDevices();
        }
        return ApiResponse.success(devices);
    }
    
    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> getDeviceStats() {
        Map<String, Object> stats = new HashMap<>();
        List<Device> allDevices = deviceService.getAllDevices();
        long runningCount = allDevices.stream().filter(d -> "running".equals(d.getStatus())).count();
        long stoppedCount = allDevices.stream().filter(d -> "stopped".equals(d.getStatus())).count();
        long faultCount = allDevices.stream().filter(d -> "fault".equals(d.getStatus())).count();
        stats.put("total", allDevices.size());
        stats.put("running", runningCount);
        stats.put("stopped", stoppedCount);
        stats.put("fault", faultCount);
        return ApiResponse.success(stats);
    }
    
    @GetMapping("/types")
    public ApiResponse<List<String>> getDeviceTypes() {
        List<Device> allDevices = deviceService.getAllDevices();
        List<String> types = allDevices.stream()
                .map(Device::getType)
                .distinct()
                .collect(Collectors.toList());
        return ApiResponse.success(types);
    }
    
    @GetMapping("/{id}")
    public ApiResponse<Device> getDeviceById(@PathVariable Long id) {
        return deviceService.getDeviceById(id)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("设备不存在"));
    }
    
    @PostMapping
    public ApiResponse<Device> createDevice(@RequestBody Device device) {
        return ApiResponse.success(deviceService.createDevice(device));
    }
    
    @PutMapping("/{id}")
    public ApiResponse<Device> updateDevice(@PathVariable Long id, @RequestBody Device device) {
        return deviceService.updateDevice(id, device)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("设备不存在"));
    }
    
    @PutMapping("/{id}/status")
    public ApiResponse<Device> updateDeviceStatus(
            @PathVariable Long id, 
            @RequestParam String status) {
        return deviceService.getDeviceById(id)
                .map(device -> {
                    device.setStatus(status);
                    return ApiResponse.success(deviceService.updateDevice(id, device).get());
                })
                .orElse(ApiResponse.error("设备不存在"));
    }
    
    @GetMapping("/{id}/data")
    public ApiResponse<List<DeviceData>> getDeviceData(
            @PathVariable Long id,
            @RequestParam(required = false, defaultValue = "24") Integer hours) {
        return ApiResponse.success(deviceService.getDeviceData(id));
    }
    
    @GetMapping("/{id}/data/latest")
    public ApiResponse<DeviceData> getLatestDeviceData(@PathVariable Long id) {
        List<DeviceData> data = deviceService.getDeviceData(id);
        if (data.isEmpty()) {
            return ApiResponse.error("暂无设备数据");
        }
        return ApiResponse.success(data.get(data.size() - 1));
    }
    
    @GetMapping("/data/latest")
    public ApiResponse<List<DeviceData>> getAllLatestDeviceData() {
        return ApiResponse.success(deviceService.getLatestDeviceData());
    }
}
